/*!
 * DKBoardZip — ZIP in/out helper for the DoKit Board Photo bulk tool.
 *
 * Why this file exists: bulk import/export needs to read ZIP archives of
 * images (import) and write one ZIP of processed images (export). The work
 * is done by fflate (vendored at assets/js/vendor/fflate.min.js) — this
 * module adds the Board Photo rules on top: image sniffing by magic bytes,
 * ZIP-bomb / traversal / entry-count guards, duplicate detection and the
 * 500-image session cap.
 *
 * Loading: fflate MUST be loaded before this file (script tag order in the
 * browser). In Node, the vendored fflate is required from ./vendor/.
 * No CDN, no modules: classic script, `var` only, UMD wrapper exposing
 * `window.DKBoardZip` in the browser and `module.exports` in Node.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && typeof module.exports === 'object') {
    // Node: load the vendored fflate that sits next to this file.
    module.exports = factory(require('./vendor/fflate.min.js'));
  } else {
    // Browser: fflate must already be on the page (script tag before this).
    root.DKBoardZip = factory(root.fflate);
  }
}(typeof self !== 'undefined' ? self : this, function (fflate) {
  'use strict';

  // Fail fast with a clear message if fflate was not loaded first.
  if (!fflate || typeof fflate.zipSync !== 'function' ||
      typeof fflate.unzipSync !== 'function') {
    throw new Error('DKBoardZip needs fflate loaded first ' +
      '(assets/js/vendor/fflate.min.js before board-photo-zip.js).');
  }

  // ------------------------------------------------------------------
  // Limits — single source of truth for every cap in this module.
  // MAX_FILE_MB is the Board Photo per-file limit; the ZIP caps mirror it
  // so a hostile archive cannot smuggle in what a direct upload could not.
  // ------------------------------------------------------------------
  var LIMITS = {
    MAX_IMAGES: 500,                                  // images per bulk session
    MAX_FILE_MB: 25,                                  // MB per image file
    MAX_ZIP_ENTRIES: 600,                             // file entries per archive
    MAX_ZIP_TOTAL_UNCOMPRESSED: 500 * 1024 * 1024,    // 500 MB total, uncompressed
    MAX_ZIP_SINGLE_FILE: 25 * 1024 * 1024,            // 25 MB per entry, uncompressed
    MAX_ZIP_RATIO: 200                                // uncompressed / compressed
  };

  // ------------------------------------------------------------------
  // Reason codes (machine-readable; every rejection carries one).
  //   zip_corrupt      archive cannot be read (truncated / bad structure)
  //   zip_encrypted    archive (or an entry) is password-protected
  //   zip_bomb         uncompressed/compressed ratio exceeds MAX_ZIP_RATIO
  //   too_many_entries file-entry count exceeds MAX_ZIP_ENTRIES
  //   total_too_large  total uncompressed size exceeds the cap
  //   file_too_large   one entry exceeds MAX_ZIP_SINGLE_FILE
  //   path_traversal   entry name escapes the archive folder (.. / / / C:)
  //   invalid_name     entry has no usable name
  //   not_image        entry bytes are not PNG / JPEG / WebP
  //   limit            image would exceed the 500-image session cap
  // Duplicates are NOT in `rejected`; they are listed in `duplicates`.
  // ------------------------------------------------------------------

  // ------------------------------------------------------------------
  // sniffImage(u8) — image type by magic bytes ONLY, never by extension.
  // PNG  : 89 50 4E 47 0D 0A 1A 0A
  // JPEG : FF D8 FF
  // WebP : bytes 0-3 'RIFF' and bytes 8-11 'WEBP'
  // Returns 'png' | 'jpeg' | 'webp' | null.
  // ------------------------------------------------------------------
  function sniffImage(u8) {
    if (!u8 || u8.length === 0) { return null; }
    // PNG signature (8 bytes).
    if (u8.length >= 8 &&
        u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E && u8[3] === 0x47 &&
        u8[4] === 0x0D && u8[5] === 0x0A && u8[6] === 0x1A && u8[7] === 0x0A) {
      return 'png';
    }
    // JPEG start-of-image marker (3 bytes).
    if (u8.length >= 3 && u8[0] === 0xFF && u8[1] === 0xD8 && u8[2] === 0xFF) {
      return 'jpeg';
    }
    // WebP: RIFF container with WEBP chunk type (12 bytes).
    if (u8.length >= 12 &&
        u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 &&
        u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50) {
      return 'webp';
    }
    return null;
  }

  // ------------------------------------------------------------------
  // FNV-1a 32-bit hash over raw bytes, returned as a hex string plus the
  // byte size. Two files with the same bytes AND size are duplicates;
  // hashing content (not names) catches renamed copies too.
  // ------------------------------------------------------------------
  function fnv1aHash(u8) {
    var hash = 0x811c9dc5; // FNV offset basis
    var i;
    for (i = 0; i < u8.length; i++) {
      hash ^= u8[i];
      // Math.imul keeps the multiply in 32-bit (avoids float rounding).
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    // Unsigned hex, zero-padded to 8 chars, plus size for extra safety.
    return ('0000000' + (hash >>> 0).toString(16)).slice(-8) + '-' + u8.length;
  }

  // ------------------------------------------------------------------
  // isUnsafeName(name) — true when the entry name could escape the folder
  // it is extracted into: a `..` segment, a leading `/` or `\`, or a
  // Windows drive letter (e.g. `C:`). Both `/` and `\` count as separators.
  // ------------------------------------------------------------------
  function isUnsafeName(name) {
    var i;
    var parts;
    if (!name || name.length === 0) { return true; }
    if (name.charAt(0) === '/' || name.charAt(0) === '\\') { return true; }
    if (/^[A-Za-z]:/.test(name)) { return true; }
    parts = name.split(/[/\\]/);
    for (i = 0; i < parts.length; i++) {
      if (parts[i] === '..') { return true; }
    }
    return false;
  }

  // ------------------------------------------------------------------
  // readCentralDirectory(u8) — minimal EOCD + central-directory walk.
  // Returns { total, encrypted } (encrypted = any entry has general
  // purpose flag bit 0 set), or null when the records cannot be parsed.
  //
  // Why a header check, not a try/catch: fflate 0.8.2 does NOT throw on
  // ZipCrypto-encrypted entries (verified 2026-11-18 with `zip -P`): it
  // inflates the encrypted bytes into garbage instead. So the throw
  // classifier below can never see these archives — the flag must be
  // read from the headers first. A null return is not an error: the
  // normal unzip path then classifies the archive (usually zip_corrupt).
  // ------------------------------------------------------------------
  function readCentralDirectory(u8) {
    var i;
    var eocd = -1;
    // End of central directory: last 22 bytes, plus up to 64 KB comment.
    var start = u8.length - 22;
    if (start < 0) { return null; }
    var min = u8.length - 22 - 65535;
    if (min < 0) { min = 0; }
    for (i = start; i >= min; i--) {
      if (u8[i] === 0x50 && u8[i + 1] === 0x4B && u8[i + 2] === 0x05 &&
          u8[i + 3] === 0x06) {
        eocd = i;
        break;
      }
    }
    if (eocd === -1) { return null; }
    // Total entries (u16 LE at +10), central-directory offset (u32 LE +16).
    var total = u8[eocd + 10] | (u8[eocd + 11] << 8);
    var cdOff = (u8[eocd + 16] | (u8[eocd + 17] << 8) |
      (u8[eocd + 18] << 16) | (u8[eocd + 19] << 24)) >>> 0;
    var p = cdOff;
    var encrypted = false;
    var n;
    for (n = 0; n < total; n++) {
      // Each entry must start with the central-directory signature.
      if (p + 46 > u8.length ||
          u8[p] !== 0x50 || u8[p + 1] !== 0x4B ||
          u8[p + 2] !== 0x01 || u8[p + 3] !== 0x02) {
        return null;
      }
      // General-purpose flag (u16 LE at +8); bit 0 = encrypted.
      var flags = u8[p + 8] | (u8[p + 9] << 8);
      if (flags & 1) { encrypted = true; }
      // Step to the next entry: 46 fixed bytes + name + extra + comment.
      var nameLen = u8[p + 28] | (u8[p + 29] << 8);
      var extraLen = u8[p + 30] | (u8[p + 31] << 8);
      var commentLen = u8[p + 32] | (u8[p + 33] << 8);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return { total: total, encrypted: encrypted };
  }

  // ------------------------------------------------------------------
  // classifyUnzipError(err) — second layer for archives the header walk
  // could not classify (e.g. AES-encrypted entries, where fflate may
  // throw). An encrypted archive mentions encryption in the message;
  // anything else is corrupt. The primary encrypted check is the
  // central-directory flag walk in readCentralDirectory, above.
  // ------------------------------------------------------------------
  function classifyUnzipError(err) {
    var msg = (err && err.message) ? String(err.message) : '';
    if (/encrypt/i.test(msg)) { return 'zip_encrypted'; }
    return 'zip_corrupt';
  }

  // ------------------------------------------------------------------
  // mergeLimits(overrides) — caller overrides on top of LIMITS; unknown
  // keys are ignored and LIMITS itself is never mutated.
  // ------------------------------------------------------------------
  function mergeLimits(overrides) {
    var out = {};
    var key;
    for (key in LIMITS) {
      if (Object.prototype.hasOwnProperty.call(LIMITS, key)) {
        out[key] = LIMITS[key];
      }
    }
    if (overrides) {
      for (key in overrides) {
        if (Object.prototype.hasOwnProperty.call(overrides, key) &&
            Object.prototype.hasOwnProperty.call(out, key)) {
          out[key] = overrides[key];
        }
      }
    }
    return out;
  }

  // ------------------------------------------------------------------
  // toUint8(input) — accept an ArrayBuffer or a Uint8Array; anything else
  // is a programmer error, so throw instead of guessing.
  // ------------------------------------------------------------------
  function toUint8(input) {
    if (input instanceof Uint8Array) { return input; }
    if (typeof ArrayBuffer !== 'undefined' && input instanceof ArrayBuffer) {
      return new Uint8Array(input);
    }
    throw new TypeError('Expected an ArrayBuffer or Uint8Array.');
  }

  // ------------------------------------------------------------------
  // extractImages(arrayBuffer, opts)
  // opts = { limits, alreadyHave } — alreadyHave is how many images the
  // session already holds, so the 500 cap spans the whole session.
  //
  // Entries are walked in ARCHIVE order (the order fflate returns them,
  // which is the order stored in the ZIP). They are deliberately NOT
  // re-sorted, so the same archive always imports in the same order.
  //
  // Whole-archive rejections (zip_bomb / too_many_entries / total_too_large
  // / zip_corrupt / zip_encrypted) return no images at all, with a single
  // rejected entry { name: '', reason } — the archive itself is the problem,
  // not one file inside it.
  //
  // NOTE on memory: fflate.unzipSync decompresses the whole archive before
  // these checks run, so the ratio/total caps bound what is ACCEPTED, not
  // peak memory. A streaming unzip would be needed to bound memory too;
  // for the Board Photo caps (500 images x 25 MB) unzipSync is the
  // pragmatic choice, and the caps still keep hostile content out of the
  // session. Never feed an unbounded archive to this function from a
  // context where memory is untrusted.
  //
  // Returns:
  //   { images:    [{ name, data: Uint8Array, size, hash }],
  //     rejected:  [{ name, reason }],
  //     duplicates:[ names ],
  //     stats:     { entries, imagesFound, rejectedCount, duplicateCount } }
  // The input buffer is never mutated. `imagesFound` counts every entry
  // that sniffed as a real image within the size cap (accepted + duplicate
  // + over-the-session-cap); `rejectedCount` is rejected.length.
  // ------------------------------------------------------------------
  function extractImages(arrayBuffer, opts) {
    var input = toUint8(arrayBuffer);
    var options = opts || {};
    var limits = mergeLimits(options.limits);
    var alreadyHave = options.alreadyHave || 0;
    if (alreadyHave < 0) { alreadyHave = 0; }

    var images = [];
    var rejected = [];
    var duplicates = [];
    var seenHashes = {};
    var imagesFound = 0;

    var unzipped;
    // Encrypted entries are rejected BEFORE decompression: fflate does
    // not throw on ZipCrypto, it returns garbage bytes, so the header
    // flag is the only reliable signal (see readCentralDirectory).
    var cd = readCentralDirectory(input);
    if (cd && cd.encrypted) {
      return {
        images: [],
        rejected: [{ name: '', reason: 'zip_encrypted' }],
        duplicates: [],
        stats: { entries: cd.total, imagesFound: 0, rejectedCount: 1, duplicateCount: 0 }
      };
    }
    try {
      // One call decompresses every entry; throws on corrupt/encrypted.
      unzipped = fflate.unzipSync(input);
    } catch (err) {
      return {
        images: [],
        rejected: [{ name: '', reason: classifyUnzipError(err) }],
        duplicates: [],
        stats: { entries: 0, imagesFound: 0, rejectedCount: 1, duplicateCount: 0 }
      };
    }

    var names = Object.keys(unzipped);
    var totalEntries = names.length;

    // Count real file entries (directories end in '/' and are skipped).
    var fileCount = 0;
    var i;
    for (i = 0; i < names.length; i++) {
      if (names[i].charAt(names[i].length - 1) !== '/') { fileCount++; }
    }
    if (fileCount > limits.MAX_ZIP_ENTRIES) {
      return {
        images: [],
        rejected: [{ name: '', reason: 'too_many_entries' }],
        duplicates: [],
        stats: { entries: totalEntries, imagesFound: 0, rejectedCount: 1, duplicateCount: 0 }
      };
    }

    // Total uncompressed size + bomb ratio, before accepting anything.
    // (Sizes come from the already-decompressed entries; see memory note.)
    var totalUncompressed = 0;
    for (i = 0; i < names.length; i++) {
      totalUncompressed += unzipped[names[i]].length;
    }
    if (totalUncompressed > limits.MAX_ZIP_TOTAL_UNCOMPRESSED) {
      return {
        images: [],
        rejected: [{ name: '', reason: 'total_too_large' }],
        duplicates: [],
        stats: { entries: totalEntries, imagesFound: 0, rejectedCount: 1, duplicateCount: 0 }
      };
    }
    if (input.length > 0 &&
        totalUncompressed / input.length > limits.MAX_ZIP_RATIO) {
      return {
        images: [],
        rejected: [{ name: '', reason: 'zip_bomb' }],
        duplicates: [],
        stats: { entries: totalEntries, imagesFound: 0, rejectedCount: 1, duplicateCount: 0 }
      };
    }

    // Walk entries in archive order; each entry gets exactly one outcome.
    for (i = 0; i < names.length; i++) {
      var name = names[i];
      var data = unzipped[name];

      // Directories are skipped silently (they hold no image bytes).
      if (name.charAt(name.length - 1) === '/') { continue; }
      // A hostile name is recorded, never extracted.
      if (!name || isUnsafeName(name)) {
        rejected.push({ name: name || '', reason: name ? 'path_traversal' : 'invalid_name' });
        continue;
      }
      // One entry may not exceed the per-file cap.
      if (data.length > limits.MAX_ZIP_SINGLE_FILE) {
        rejected.push({ name: name, reason: 'file_too_large' });
        continue;
      }
      // Magic bytes decide: anything else is not an image, whatever its
      // extension claims. Empty files sniff to null, so land here too.
      if (sniffImage(data) === null) {
        rejected.push({ name: name, reason: 'not_image' });
        continue;
      }
      imagesFound++;
      // Same bytes + same size seen before in this archive = duplicate.
      var hash = fnv1aHash(data);
      if (seenHashes[hash]) {
        duplicates.push(name);
        continue;
      }
      seenHashes[hash] = true;
      // Session cap spans alreadyHave + everything accepted so far.
      if (alreadyHave + images.length >= limits.MAX_IMAGES) {
        rejected.push({ name: name, reason: 'limit' });
        continue;
      }
      images.push({ name: name, data: data, size: data.length, hash: hash });
    }

    return {
      images: images,
      rejected: rejected,
      duplicates: duplicates,
      stats: {
        entries: totalEntries,
        imagesFound: imagesFound,
        rejectedCount: rejected.length,
        duplicateCount: duplicates.length
      }
    };
  }

  // ------------------------------------------------------------------
  // createZip(files) — files = [{ name, data: Uint8Array }].
  // Names must be safe basenames (no `/`, no `\`, no `..`): the exported
  // ZIP must be safe to unzip anywhere. Data must be non-empty.
  // Returns the ZIP as a Uint8Array (fflate.zipSync, level 6).
  // Throws on bad input — a bad export is a programmer error, not data.
  // ------------------------------------------------------------------
  function createZip(files) {
    if (!files || !files.length) {
      throw new Error('createZip needs a non-empty file list.');
    }
    var obj = {};
    var i;
    for (i = 0; i < files.length; i++) {
      var file = files[i];
      var name = file && file.name;
      var data = file && file.data;
      if (typeof name !== 'string' || name.length === 0 ||
          name.indexOf('/') !== -1 || name.indexOf('\\') !== -1 ||
          name === '..' || name === '.' || name.indexOf('..') !== -1) {
        throw new Error('createZip: unsafe file name "' + name + '" — ' +
          'export names must be plain basenames.');
      }
      if (!(data instanceof Uint8Array) || data.length === 0) {
        throw new Error('createZip: file "' + name + '" has no data.');
      }
      obj[name] = data;
    }
    return fflate.zipSync(obj, { level: 6 });
  }

  // ------------------------------------------------------------------
  // verifyZip(u8) — integrity check used after an export: re-read the ZIP
  // and list its entries. { ok: true, names } or { ok: false, reason }.
  // ------------------------------------------------------------------
  function verifyZip(u8) {
    var input;
    try {
      input = toUint8(u8);
    } catch (err) {
      return { ok: false, reason: 'zip_corrupt' };
    }
    // Same header check as extractImages: an encrypted archive is not a
    // valid export, even though fflate would "read" it as garbage.
    var cd = readCentralDirectory(input);
    if (cd && cd.encrypted) {
      return { ok: false, reason: 'zip_encrypted' };
    }
    try {
      var unzipped = fflate.unzipSync(input);
      return { ok: true, names: Object.keys(unzipped) };
    } catch (err) {
      return { ok: false, reason: classifyUnzipError(err) };
    }
  }

  // Public API (browser global DKBoardZip / Node module.exports).
  return {
    LIMITS: LIMITS,
    sniffImage: sniffImage,
    extractImages: extractImages,
    createZip: createZip,
    verifyZip: verifyZip
  };
}));
