/* DoKit home page — category accordion (readable source).
   Categories: Image Tools / Text Tools / Typing / Coming Soon.
   - Hover (fine pointers): card lifts + tool-name peek strip fades in (pure CSS).
   - Click / tap: accordion expands (single-open). Mobile = tap (no hover needed).
   - Search: switches to grouped flat results; clearing restores categories.
   - Worker 3 extras: pastel circular category icons, bento grid (desktop),
     favorites (dk_favs, star toggles, sort first), recently-used row +
     frequency-based personalized ordering (dk_recent {slug,ts,count}),
     animated hero typing demo, count-up stats, first-visit "/" hint,
     hero illustration slot (.illus-slot).
   i18n via window.DKI18N; en+ur full, other languages fall back to English.
   CSP-safe: no inline handlers, no external URLs. */
!function(){
"use strict";
var HOME_DICTS = {"en":{"hero_eyebrow":"Free online tools","hero_h1":"Every tool you'll ever need.","hero_tag":"Resize images, count words, master typing — fast, free, and private. Nothing leaves your browser.","hero_cta_tools":"Browse all tools","hero_cta_typing":"Start typing practice","search_ph":"Search tools… e.g. resize, words","search_label":"Search tools","popular_title":"Popular tools","popular_sub":"The tools people reach for every day.","tools_empty":"No tools match your search. Try another word.","why_title":"Why DoKit?","why_sub":"Built differently — on purpose.","why1_t":"Private by design","why1_d":"Your files never leave your device. Everything runs in your browser — nothing to hack, nothing to leak.","why2_t":"Blazing fast","why2_d":"Zero bloat, zero tracking scripts. Pages open in a blink and tools respond instantly.","why3_t":"Free core, forever","why3_d":"Every tool on this page is free to use — no account, no watermarks, no catches.","why4_t":"English + اردو","why4_d":"A full Urdu interface with right-to-left layout, alongside English. Switch anytime.","stat_tools_l":"Free tools","stat_private_l":"Private — files stay on your device","stat_signup_l":"Sign-up required","stat_lang_l":"Languages","faq_teaser_t":"Quick answers","faq_teaser_sub":"The three questions everyone asks first.","fq1_q":"Is DoKit really free?","fq1_a":"Yes — every tool listed here is free with no account, no watermarks, and no usage caps on normal use.","fq2_q":"Do my files get uploaded anywhere?","fq2_a":"Never. Image tools process your files inside your own browser. Close the tab and nothing remains on our side — because there is no “our side”.","fq3_q":"Do I need to create an account?","fq3_a":"No. Open a tool and use it. Settings like theme and language are saved only on your own device.","faq_more":"More questions","cta_t":"Ready to get things done?","cta_d":"Join thousands of people using DoKit's free tools every day. No signup required.","cta_btn":"Explore tools","cat_label":"Filter by category","cats_title":"Browse by category","cats_sub":"Tap a category to see its tools — or search above.","cat_image_t":"Image Tools","cat_image_d":"Resize, compress, convert — everything for your pictures.","cat_text_t":"Text Tools","cat_text_d":"Count words and switch letter cases in seconds.","cat_typing_t":"Typing","cat_typing_d":"Lessons, tests and games to type faster.","cat_coming_t":"Coming Soon","cat_coming_d":"Typing battles are on the way.","cat_n_tools":"tools","cat_open":"Show tools","cat_close":"Hide tools","search_results_t":"Search results","home2.demo_title":"Live in your browser","home2.demo_prompt":"dokit ›","home2.demo_p1":"Resize images…","home2.demo_p2":"Count words…","home2.demo_p3":"Compress photos…","home2.demo_p4":"Practice typing…","home2.bar_free":"free","home2.bar_signup0":"sign-ups needed","home2.bar_private":"Private by design","home2.recent_t":"Recently used","home2.fav_on":"Add to favorites","home2.fav_off":"Remove from favorites","home2.hint_a":"Tip: press","home2.hint_b":"to search","home2.hint_dismiss":"Dismiss tip","home2.proof_t":"Made for everyday people","home2.proof_sub":"Students, freelancers and shop owners reach for DoKit daily — no sign-up, no learning curve.","home2.seg1_t":"Students","home2.seg1_d":"Word counts checked and essays polished — right before the deadline, no account needed.","home2.seg2_t":"Freelancers","home2.seg2_d":"Client images resized and compressed in the browser — nothing uploaded, nothing to explain.","home2.seg3_t":"Small shops","home2.seg3_d":"Product photos converted and shrunk before listing — files never leave the device.","home2.kicker_cats":"Find your tool","home2.kicker_why":"The DoKit promise","home2.kicker_proof":"Loved in real life","home2.strip_label":"DoKit at a glance","home2.hero_h1":"Get everyday tasks done in seconds \u2014 free.","home2.strip_tools":"tools","home2.strip_nosignup":"No sign-up"},"ur":{"hero_eyebrow":"مفت آن لائن ٹولز","hero_h1":"ہر وہ ٹول جو آپ کو کبھی چاہیے۔","hero_tag":"تصویریں ری سائز کریں، الفاظ گنیں، ٹائپنگ سیکھیں — تیز، مفت اور نجی۔ آپ کی فائلیں ڈیوائس سے باہر نہیں جاتیں۔","hero_cta_tools":"تمام ٹولز دیکھیں","hero_cta_typing":"ٹائپنگ کی مشق شروع کریں","search_ph":"ٹولز تلاش کریں… مثلاً ری سائز، الفاظ","search_label":"ٹولز تلاش کریں","popular_title":"مقبول ٹولز","popular_sub":"وہ ٹولز جن کی روز ضرورت پڑتی ہے۔","tools_empty":"آپ کی تلاش سے کوئی ٹول نہیں ملا۔ کوئی اور لفظ آزمائیں۔","why_title":"ڈوکٹ کیوں؟","why_sub":"جان بوجھ کر مختلف بنایا گیا۔","why1_t":"نجی، بطور ڈیزائن","why1_d":"آپ کی فائلیں آپ کے ڈیوائس سے باہر نہیں جاتیں۔ سب کچھ آپ کے براؤزر میں چلتا ہے — نہ ہیک ہونے کا ڈر، نہ لیک ہونے کا۔","why2_t":"بجلی جیسی رفتار","why2_d":"نہ بھاری پن، نہ ٹریکنگ اسکرپٹ۔ صفحات پلک جھپکتے میں کھلتے ہیں اور ٹولز فوراً جواب دیتے ہیں۔","why3_t":"بنیادی ٹولز ہمیشہ مفت","why3_d":"اس صفحے کا ہر ٹول مفت ہے — نہ اکاؤنٹ، نہ واٹر مارک، نہ کوئی چھپی شرط۔","why4_t":"انگریزی + اردو","why4_d":"انگریزی کے ساتھ مکمل اردو انٹرفیس، دائیں سے بائیں ترتیب سمیت۔ جب چاہیں تبدیل کریں۔","stat_tools_l":"مفت ٹولز","stat_private_l":"نجی — فائلیں آپ کے ڈیوائس پر رہتی ہیں","stat_signup_l":"سائن اپ درکار","stat_lang_l":"زبانیں","faq_teaser_t":"فوری جوابات","faq_teaser_sub":"وہ تین سوالات جو سب سے پہلے پوچھے جاتے ہیں۔","fq1_q":"کیا ڈوکٹ واقعی مفت ہے؟","fq1_a":"جی ہاں — یہاں درج ہر ٹول بغیر اکاؤنٹ، بغیر واٹر مارک مفت ہے۔","fq2_q":"کیا میری فائلیں کہیں اپ لوڈ ہوتی ہیں؟","fq2_a":"کبھی نہیں۔ تصویری ٹولز آپ کی فائلیں آپ کے براؤزر میں پروسیس کرتے ہیں۔ ٹیب بند کرتے ہی کچھ باقی نہیں رہتا۔","fq3_q":"کیا اکاؤنٹ بنانا ضروری ہے؟","fq3_a":"نہیں۔ ٹول کھولیں اور استعمال کریں۔ تھیم اور زبان جیسی ترتیبات صرف آپ کے ڈیوائس پر محفوظ ہوتی ہیں۔","faq_more":"مزید سوالات","cta_t":"اپنے براؤزر میں مزید کام نمٹائیں۔","cta_d":"آج چھ مفت ٹولز، مزید آ رہے ہیں۔ ڈوکٹ بک مارک کریں۔","cta_btn":"ٹولز دیکھیں","cat_label":"زمرے کے حساب سے چھانٹیں","cats_title":"زمرے کے حساب سے دیکھیں","cats_sub":"ٹولز دیکھنے کے لیے کسی زمرے پر ٹیپ کریں — یا اوپر تلاش کریں۔","cat_image_t":"تصویری ٹولز","cat_image_d":"ری سائز کریں، کمپریس کریں، کنورٹ کریں — آپ کی تصویروں کے لیے سب کچھ۔","cat_text_t":"تحریری ٹولز","cat_text_d":"الفاظ گنیں اور حروف کے انداز بدلیں — چند سیکنڈ میں۔","cat_typing_t":"ٹائپنگ","cat_typing_d":"تیز ٹائپنگ کے لیے اسباق، ٹیسٹ اور گیمز۔","cat_coming_t":"جلد آ رہا ہے","cat_coming_d":"ٹائپ فائٹ کے دلچسپ مقابلے آنے والے ہیں۔","cat_n_tools":"ٹولز","cat_open":"ٹولز دکھائیں","cat_close":"ٹولز چھپائیں","search_results_t":"تلاش کے نتائج","home2.demo_title":"براہِ راست آپ کے براؤزر میں","home2.demo_prompt":"dokit ›","home2.demo_p1":"تصویریں ری سائز کریں…","home2.demo_p2":"الفاظ گنیں…","home2.demo_p3":"تصویریں کمپریس کریں…","home2.demo_p4":"ٹائپنگ کی مشق کریں…","home2.bar_free":"مفت","home2.bar_signup0":"سائن اپ درکار","home2.bar_private":"مکمل نجی","home2.recent_t":"حال ہی میں استعمال شدہ","home2.fav_on":"پسندیدہ میں شامل کریں","home2.fav_off":"پسندیدہ سے ہٹائیں","home2.hint_a":"ٹپ: دبائیں","home2.hint_b":"تلاش کرنے کے لیے","home2.hint_dismiss":"ٹپ بند کریں","home2.proof_t":"عام لوگوں کے لیے بنایا گیا","home2.proof_sub":"طلبہ، فری لانسر اور دکان دار روزانہ ڈوکٹ استعمال کرتے ہیں — نہ سائن اپ، نہ سیکھنے کی جھنجھٹ۔","home2.seg1_t":"طلبہ","home2.seg1_d":"ڈیڈ لائن سے پہلے الفاظ گنے اور مضامین سنوارے — بغیر اکاؤنٹ بنائے۔","home2.seg2_t":"فری لانسرز","home2.seg2_d":"کلائنٹ کی تصویریں براؤزر میں ری سائز اور کمپریس کیں — نہ اپ لوڈ، نہ وضاحت کی ضرورت۔","home2.seg3_t":"چھوٹی دکانیں","home2.seg3_d":"لسٹنگ سے پہلے مصنوعات کی تصویریں تبدیل اور چھوٹی کیں — فائلیں ڈیوائس سے باہر نہیں گئیں۔","home2.kicker_cats":"اپنا ٹول تلاش کریں","home2.kicker_why":"ڈوکٹ کا وعدہ","home2.kicker_proof":"اصلی زندگی میں مقبول","home2.strip_label":"ایک نظر میں ڈوکٹ","home2.hero_h1":"روزمرہ کے کام سیکنڈوں میں نمٹائیں — مفت۔","home2.strip_tools":"ٹولز","home2.strip_nosignup":"بغیر سائن اپ"},"ar":{"hero_eyebrow":"أدوات مجانية على الإنترنت","hero_h1":"كل أداة قد تحتاجها يومًا.","hero_tag":"غيّر حجم الصور، واحسب الكلمات، وحوّل الملفات، وأتقن الطباعة — بسرعة ومجانًا وبخصوصية. بلا حساب، بلا رفع.","hero_cta_tools":"تصفح كل الأدوات","hero_cta_typing":"ابدأ تدريب الطباعة","search_ph":"ابحث عن الأدوات…","search_label":"ابحث عن الأدوات","popular_title":"أدوات شائعة","popular_sub":"الأدوات التي يستخدمها الناس كل يوم.","tools_empty":"لا توجد أدوات تطابق بحثك. جرّب كلمة أخرى.","why_title":"لماذا DoKit؟","why_sub":"مصمم بشكل مختلف — عن قصد.","why1_t":"خاص بالتصميم","why1_d":"ملفاتك لا تغادر جهازك أبدًا. كل شيء يعمل في متصفحك.","why2_t":"سرعة فائقة","why2_d":"بلا ثقل، بلا تتبع. الصفحات تفتح في لمح البصر.","why3_t":"الأساس مجاني للأبد","why3_d":"كل أداة في هذه الصفحة مجانية — بلا حساب وبلا علامات مائية.","why4_t":"الإنجليزية + اردو","why4_d":"واجهة أردية كاملة مع تخطيط من اليمين لليسار.","stat_tools_l":"أدوات مجانية","stat_private_l":"خاص — الملفات تبقى على جهازك","stat_signup_l":"تسجيل مطلوب","stat_lang_l":"اللغات","faq_teaser_t":"إجابات سريعة","faq_teaser_sub":"الأسئلة الثلاثة الأولى.","fq1_q":"هل DoKit مجاني حقًا؟","fq1_a":"نعم — كل أداة هنا مجانية بلا حساب وبلا علامات مائية.","fq2_q":"هل تُرفع ملفاتي إلى أي مكان؟","fq2_a":"أبدًا. أدوات الصور تعالج ملفاتك داخل متصفحك.","fq3_q":"هل أحتاج إلى حساب؟","fq3_a":"لا. افتح أداة واستخدمها.","faq_more":"المزيد من الأسئلة","cta_t":"أنجز المزيد، في متصفحك مباشرة.","cta_d":"ست أدوات مجانية اليوم، والمزيد قادم.","cta_btn":"استكشف الأدوات","cat_label":"رشّح حسب الفئة"},"hi":{"hero_eyebrow":"मुफ्त ऑनलाइन टूल्स","hero_h1":"हर वह टूल जो आपको कभी चाहिए।","hero_tag":"तस्वीरें रीसाइज़ करें, शब्द गिनें, फ़ाइलें बदलें, टाइपिंग में महारत हासिल करें — तेज़, मुफ्त और निजी। न साइन-अप, न अपलोड।","hero_cta_tools":"सभी टूल्स देखें","hero_cta_typing":"टाइपिंग अभ्यास शुरू करें","search_ph":"टूल्स खोजें…","search_label":"टूल्स खोजें","popular_title":"लोकप्रिय टूल्स","popular_sub":"वे टूल्स जिनकी रोज़ ज़रूरत पड़ती है।","tools_empty":"आपकी खोज से कोई टूल नहीं मिला। कोई और शब्द आज़माएं।","why_title":"DoKit क्यों?","why_sub":"जानबूझकर अलग बनाया गया।","why1_t":"डिज़ाइन से निजी","why1_d":"आपकी फ़ाइलें आपके डिवाइस से बाहर नहीं जातीं। सब आपके ब्राउज़र में चलता है।","why2_t":"बिजली जैसी गति","why2_d":"न भारीपन, न ट्रैकिंग। पेज पलक झपकते खुलते हैं।","why3_t":"बुनियादी टूल्स हमेशा मुफ्त","why3_d":"इस पेज का हर टूल मुफ्त है — न खाता, न वॉटरमार्क।","why4_t":"अंग्रेज़ी + उर्दू","why4_d":"अंग्रेज़ी के साथ पूर्ण उर्दू इंटरफ़ेस।","stat_tools_l":"मुफ्त टूल्स","stat_private_l":"निजी — फ़ाइलें आपके डिवाइस पर रहती हैं","stat_signup_l":"साइन-अप आवश्यक","stat_lang_l":"भाषाएं","faq_teaser_t":"त्वरित उत्तर","faq_teaser_sub":"वे तीन सवाल जो सबसे पहले पूछे जाते हैं।","fq1_q":"क्या DoKit सच में मुफ्त है?","fq1_a":"हां — यहां हर टूल बिना खाते, बिना वॉटरमार्क मुफ्त है।","fq2_q":"क्या मेरी फ़ाइलें कहीं अपलोड होती हैं?","fq2_a":"कभी नहीं। इमेज टूल्स आपकी फ़ाइलें आपके ब्राउज़र में प्रोसेस करते हैं।","fq3_q":"क्या खाता बनाना ज़रूरी है?","fq3_a":"नहीं। टूल खोलें और इस्तेमाल करें।","faq_more":"और सवाल","cta_t":"अपने ब्राउज़र में और काम निपटाएं।","cta_d":"आज छह मुफ्त टूल्स, और आ रहे हैं।","cta_btn":"टूल्स देखें","cat_label":"श्रेणी से छांटें"},"es":{"hero_eyebrow":"Herramientas online gratuitas","hero_h1":"Cada herramienta que puedas necesitar.","hero_tag":"Redimensiona imágenes, cuenta palabras, convierte archivos, domina la mecanografía — rápido, gratis y privado. Sin registro, sin subidas.","hero_cta_tools":"Ver todas las herramientas","hero_cta_typing":"Empezar práctica","search_ph":"Buscar herramientas…","search_label":"Buscar herramientas","popular_title":"Herramientas populares","popular_sub":"Las herramientas que la gente usa cada día.","tools_empty":"Ninguna herramienta coincide. Prueba otra palabra.","why_title":"¿Por qué DoKit?","why_sub":"Hecho diferente — a propósito.","why1_t":"Privado por diseño","why1_d":"Tus archivos nunca salen de tu dispositivo. Todo funciona en tu navegador.","why2_t":"Rapidísimo","why2_d":"Sin lastre, sin rastreo. Las páginas abren en un parpadeo.","why3_t":"Núcleo gratis, siempre","why3_d":"Cada herramienta de esta página es gratis — sin cuenta ni marcas de agua.","why4_t":"Inglés + اردو","why4_d":"Interfaz completa en urdu junto al inglés.","stat_tools_l":"Herramientas gratis","stat_private_l":"Privado — los archivos quedan en tu dispositivo","stat_signup_l":"Registro requerido","stat_lang_l":"Idiomas","faq_teaser_t":"Respuestas rápidas","faq_teaser_sub":"Las tres preguntas que todos hacen primero.","fq1_q":"¿DoKit es realmente gratis?","fq1_a":"Sí — cada herramienta aquí es gratis, sin cuenta ni marcas de agua.","fq2_q":"¿Mis archivos se suben a algún lado?","fq2_a":"Nunca. Las herramientas de imagen procesan tus archivos en tu navegador.","fq3_q":"¿Necesito crear una cuenta?","fq3_a":"No. Abre una herramienta y úsala.","faq_more":"Más preguntas","cta_t":"Haz más, en tu navegador.","cta_d":"Seis herramientas gratis hoy, más en camino.","cta_btn":"Explorar herramientas","cat_label":"Filtrar por categoría"},"fr":{"hero_eyebrow":"Outils en ligne gratuits","hero_h1":"Chaque outil dont vous aurez besoin.","hero_tag":"Redimensionnez des images, comptez des mots, convertissez des fichiers, maîtrisez le clavier — rapide, gratuit et privé. Sans compte, sans envoi.","hero_cta_tools":"Voir tous les outils","hero_cta_typing":"Commencer l'entraînement","search_ph":"Rechercher des outils…","search_label":"Rechercher des outils","popular_title":"Outils populaires","popular_sub":"Les outils que les gens utilisent chaque jour.","tools_empty":"Aucun outil ne correspond. Essayez un autre mot.","why_title":"Pourquoi DoKit ?","why_sub":"Conçu différemment — exprès.","why1_t":"Privé par conception","why1_d":"Vos fichiers ne quittent jamais votre appareil. Tout fonctionne dans votre navigateur.","why2_t":"Ultra rapide","why2_d":"Zéro lourdeur, zéro suivi. Les pages s'ouvrent en un clin d'œil.","why3_t":"Cœur gratuit, pour toujours","why3_d":"Chaque outil de cette page est gratuit — sans compte ni filigrane.","why4_t":"Anglais + اردو","why4_d":"Interface complète en ourdou, à côté de l'anglais.","stat_tools_l":"Outils gratuits","stat_private_l":"Privé — les fichiers restent sur votre appareil","stat_signup_l":"Inscription requise","stat_lang_l":"Langues","faq_teaser_t":"Réponses rapides","faq_teaser_sub":"Les trois questions que tout le monde pose d'abord.","fq1_q":"DoKit est-il vraiment gratuit ?","fq1_a":"Oui — chaque outil ici est gratuit, sans compte ni filigrane.","fq2_q":"Mes fichiers sont-ils envoyés quelque part ?","fq2_a":"Jamais. Les outils d'image traitent vos fichiers dans votre navigateur.","fq3_q":"Faut-il créer un compte ?","fq3_a":"Non. Ouvrez un outil et utilisez-le.","faq_more":"Plus de questions","cta_t":"Faites-en plus, dans votre navigateur.","cta_d":"Six outils gratuits aujourd'hui, d'autres arrivent.","cta_btn":"Explorer les outils","cat_label":"Filtrer par catégorie"},"pt":{"hero_eyebrow":"Ferramentas online grátis","hero_h1":"Cada ferramenta que você pode precisar.","hero_tag":"Redimensione imagens, conte palavras, converta arquivos, domine a digitação — rápido, grátis e privado. Sem cadastro, sem uploads.","hero_cta_tools":"Ver todas as ferramentas","hero_cta_typing":"Começar o treino","search_ph":"Buscar ferramentas…","search_label":"Buscar ferramentas","popular_title":"Ferramentas populares","popular_sub":"As ferramentas que as pessoas usam todo dia.","tools_empty":"Nenhuma ferramenta corresponde. Tente outra palavra.","why_title":"Por que DoKit?","why_sub":"Feito diferente — de propósito.","why1_t":"Privado por design","why1_d":"Seus arquivos nunca saem do dispositivo. Tudo roda no seu navegador.","why2_t":"Rapidíssimo","why2_d":"Zero peso, zero rastreamento. As páginas abrem num piscar.","why3_t":"Núcleo grátis, para sempre","why3_d":"Cada ferramenta desta página é grátis — sem conta nem marca d'água.","why4_t":"Inglês + اردو","why4_d":"Interface completa em urdu, ao lado do inglês.","stat_tools_l":"Ferramentas grátis","stat_private_l":"Privado — arquivos ficam no seu dispositivo","stat_signup_l":"Cadastro necessário","stat_lang_l":"Idiomas","faq_teaser_t":"Respostas rápidas","faq_teaser_sub":"As três perguntas que todos fazem primeiro.","fq1_q":"DoKit é mesmo grátis?","fq1_a":"Sim — cada ferramenta aqui é grátis, sem conta nem marca d'água.","fq2_q":"Meus arquivos são enviados para algum lugar?","fq2_a":"Nunca. As ferramentas de imagem processam seus arquivos no seu navegador.","fq3_q":"Preciso criar uma conta?","fq3_a":"Não. Abra uma ferramenta e use.","faq_more":"Mais perguntas","cta_t":"Faça mais, no seu navegador.","cta_d":"Seis ferramentas grátis hoje, mais a caminho.","cta_btn":"Explorar ferramentas","cat_label":"Filtrar por categoria"},"de":{"hero_eyebrow":"Kostenlose Online-Tools","hero_h1":"Jedes Tool, das du je brauchen wirst.","hero_tag":"Bilder skalieren, Wörter zählen, Dateien umwandeln, Tippen meistern — schnell, kostenlos und privat. Kein Konto, keine Uploads.","hero_cta_tools":"Alle Tools ansehen","hero_cta_typing":"Training starten","search_ph":"Tools suchen…","search_label":"Tools suchen","popular_title":"Beliebte Tools","popular_sub":"Die Tools, die man täglich braucht.","tools_empty":"Keine Treffer. Versuch ein anderes Wort.","why_title":"Warum DoKit?","why_sub":"Absichtlich anders gebaut.","why1_t":"Privat per Design","why1_d":"Deine Dateien verlassen nie dein Gerät. Alles läuft in deinem Browser.","why2_t":"Blitzschnell","why2_d":"Null Ballast, null Tracking. Seiten öffnen sich im Handumdrehen.","why3_t":"Kern gratis, für immer","why3_d":"Jedes Tool auf dieser Seite ist kostenlos — kein Konto, kein Wasserzeichen.","why4_t":"Englisch + اردو","why4_d":"Komplette Urdu-Oberfläche neben Englisch.","stat_tools_l":"Gratis-Tools","stat_private_l":"Privat — Dateien bleiben auf deinem Gerät","stat_signup_l":"Anmeldung nötig","stat_lang_l":"Sprachen","faq_teaser_t":"Kurze Antworten","faq_teaser_sub":"Die drei Fragen, die alle zuerst stellen.","fq1_q":"Ist DoKit wirklich kostenlos?","fq1_a":"Ja — jedes Tool hier ist gratis, ohne Konto und ohne Wasserzeichen.","fq2_q":"Werden meine Dateien irgendwo hochgeladen?","fq2_a":"Niemals. Bild-Tools verarbeiten deine Dateien in deinem Browser.","fq3_q":"Brauche ich ein Konto?","fq3_a":"Nein. Tool öffnen und loslegen.","faq_more":"Mehr Fragen","cta_t":"Mehr schaffen, direkt im Browser.","cta_d":"Sechs Gratis-Tools heute, mehr kommen.","cta_btn":"Tools entdecken","cat_label":"Nach Kategorie filtern"},"tr":{"hero_eyebrow":"Ücretsiz çevrimiçi araçlar","hero_h1":"İhtiyacın olan her araç.","hero_tag":"Görselleri boyutlandır, kelimeleri say, dosyaları çevir, yazmada ustalaş — hızlı, ücretsiz ve gizli. Kayıt yok, yükleme yok.","hero_cta_tools":"Tüm araçlara bak","hero_cta_typing":"Alıştırmaya başla","search_ph":"Araç ara…","search_label":"Araç ara","popular_title":"Popüler araçlar","popular_sub":"Herkesin her gün kullandığı araçlar.","tools_empty":"Aramanla eşleşen araç yok. Başka kelime dene.","why_title":"Neden DoKit?","why_sub":"Bilerek farklı yapıldı.","why1_t":"Tasarım gereği gizli","why1_d":"Dosyaların cihazından asla çıkmaz. Her şey tarayıcında çalışır.","why2_t":"Işık hızında","why2_d":"Şişkinlik yok, takip yok. Sayfalar göz açıp kapayıncaya açılır.","why3_t":"Çekirdek hep ücretsiz","why3_d":"Bu sayfadaki her araç ücretsiz — hesap yok, filigran yok.","why4_t":"İngilizce + اردو","why4_d":"İngilizcenin yanında tam Urduca arayüz.","stat_tools_l":"Ücretsiz araç","stat_private_l":"Gizli — dosyalar cihazında kalır","stat_signup_l":"Kayıt gerekli","stat_lang_l":"Diller","faq_teaser_t":"Hızlı yanıtlar","faq_teaser_sub":"Herkesin ilk sorduğu üç soru.","fq1_q":"DoKit gerçekten ücretsiz mi?","fq1_a":"Evet — buradaki her araç ücretsiz, hesap ve filigran yok.","fq2_q":"Dosyalarım bir yere yükleniyor mu?","fq2_a":"Asla. Görsel araçları dosyalarını tarayıcında işler.","fq3_q":"Hesap açmam gerekli mi?","fq3_a":"Hayır. Bir araç aç ve kullan.","faq_more":"Diğer sorular","cta_t":"Tarayıcında daha fazlasını yap.","cta_d":"Bugün altı ücretsiz araç, yenileri yolda.","cta_btn":"Araçları keşfet","cat_label":"Kategoriye göre filtrele"},"ru":{"hero_eyebrow":"Бесплатные онлайн-инструменты","hero_h1":"Каждый инструмент, что вам понадобится.","hero_tag":"Меняйте размер изображений, считайте слова, конвертируйте файлы, осваивайте печать — быстро, бесплатно и приватно. Без регистрации и загрузок.","hero_cta_tools":"Все инструменты","hero_cta_typing":"Начать тренировку","search_ph":"Поиск инструментов…","search_label":"Поиск инструментов","popular_title":"Популярные инструменты","popular_sub":"Инструменты, нужные каждый день.","tools_empty":"Ничего не найдено. Попробуйте другое слово.","why_title":"Почему DoKit?","why_sub":"Сделан иначе — специально.","why1_t":"Приватность по дизайну","why1_d":"Ваши файлы никогда не покидают устройство. Всё работает в вашем браузере.","why2_t":"Молниеносно","why2_d":"Никакого мусора и трекинга. Страницы открываются мгновенно.","why3_t":"Ядро бесплатно навсегда","why3_d":"Каждый инструмент на этой странице бесплатен — без аккаунта и водяных знаков.","why4_t":"Английский + اردو","why4_d":"Полный интерфейс на урду рядом с английским.","stat_tools_l":"Бесплатных инструментов","stat_private_l":"Приватно — файлы остаются на устройстве","stat_signup_l":"Нужна регистрация","stat_lang_l":"Языки","faq_teaser_t":"Быстрые ответы","faq_teaser_sub":"Три вопроса, которые задают первым делом.","fq1_q":"DoKit правда бесплатный?","fq1_a":"Да — каждый инструмент здесь бесплатен, без аккаунта и водяных знаков.","fq2_q":"Мои файлы куда-то загружаются?","fq2_a":"Никогда. Инструменты обрабатывают файлы в вашем браузере.","fq3_q":"Нужен ли аккаунт?","fq3_a":"Нет. Откройте инструмент и пользуйтесь.","faq_more":"Ещё вопросы","cta_t":"Делайте больше прямо в браузере.","cta_d":"Шесть бесплатных инструментов сегодня, новые — в пути.","cta_btn":"Смотреть инструменты","cat_label":"Фильтр по категории"}};
Object.keys(HOME_DICTS).forEach(function(l){ if(window.DKI18N) DKI18N.add(l, HOME_DICTS[l]); });

function t(k){ return DKI18N.t(k); }
/* Shared esc (js/dk-utils.js) with local fallback — resolved once at load. */
var esc = (window.DKUtils && DKUtils.esc) || function(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); };

/* Category config: headline + subline keys, tool slugs from window.DKTOOLS.
   pastel: soft circular icon background per category (point: pastel icon cards). */
var CATS=[
  {id:"image", icon:"\uD83D\uDDBC\uFE0F", pastel:"pastel-blue", titleKey:"cat_image_t", subKey:"cat_image_d",
   tools:["image-resizer","image-compressor","image-converter"]},
  {id:"text", icon:"\u270D\uFE0F", pastel:"pastel-mint", titleKey:"cat_text_t", subKey:"cat_text_d",
   tools:["word-counter","case-converter"]},
  {id:"typing", icon:"\u2328\uFE0F", pastel:"pastel-peach", titleKey:"cat_typing_t", subKey:"cat_typing_d",
   tools:["typing-lessons","typing-test","typing-games","typing-practice","typing-certificate"]},
  {id:"coming", icon:"\uD83D\uDE80", pastel:"pastel-lav", titleKey:"cat_coming_t", subKey:"cat_coming_d",
   tools:["typefight"]}
];

function toolBySlug(s){
  var found=null;
  (window.DKTOOLS||[]).forEach(function(x){ if(x.slug===s) found=x; });
  return found;
}
function matchTool(tool,q){
  if(!q) return true;
  var enD=(DKI18N.dict&&DKI18N.dict.en)||{};
  var hay=(t(tool.nameKey)+" "+t(tool.descKey)+" "+(enD[tool.nameKey]||"")+" "+(enD[tool.descKey]||"")).toLowerCase();
  return hay.indexOf(q)>=0;
}
/* ---------- Worker 3 (Oct 6, 2026): localStorage helpers ----------
   dk_favs   — array of tool slugs the user starred (favorites, point 48).
   dk_recent — array of {slug, ts}, most-recent first, capped at 4 (point 47).
   dk_hint_seen — "1" once the "/" coach hint has been shown (point 50). */
var FAV_KEY="dk_favs", RECENT_KEY="dk_recent", HINT_KEY="dk_hint_seen", RECENT_MAX=4;
function lsGet(k,fb){ try{ var v=window.localStorage.getItem(k); return v?JSON.parse(v):fb; }catch(e){ return fb; } }
function lsSet(k,v){ try{ window.localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }
function getFavs(){ var f=lsGet(FAV_KEY,[]); return Array.isArray(f)?f:[]; }
function isFav(slug){ return getFavs().indexOf(slug)>=0; }
function toggleFav(slug){
  var f=getFavs(), i=f.indexOf(slug);
  if(i>=0) f.splice(i,1); else f.push(slug);
  lsSet(FAV_KEY,f);
  return i<0;
}
/* Personalized ordering: favorites first, then most-used (frequency count
   from dk_recent), then the curated config order (sort is stable). */
function usageCount(slug){
  var r=lsGet(RECENT_KEY,[]), n=0;
  if(Array.isArray(r)) r.forEach(function(x){ if(x&&x.slug===slug) n+=(+x.count)||1; });
  return n;
}
function toolOrder(a,b){
  var fa=isFav(a.slug)?0:1, fb=isFav(b.slug)?0:1;
  if(fa!==fb) return fa-fb;
  var ua=usageCount(a.slug), ub=usageCount(b.slug);
  if(ua!==ub) return ub-ua;
  return 0;
}
/* ---------- Recently used tools (point 47) ----------
   PUBLIC API for tool pages (coordinator: load a tiny shared snippet that
   defines window.DKRecent, or have tool pages call it defensively):
     window.DKRecent && window.DKRecent.push("image-resizer")
   On the home page we ALSO record visits ourselves: clicks on tool links
   are captured before navigation, so the "Recently used" row works even
   without any tool-page changes. */
window.DKRecent={
  push:function(slug){
    if(!slug||!toolBySlug(slug)) return;
    var r=lsGet(RECENT_KEY,[]), prev=0;
    if(!Array.isArray(r)) r=[];
    r=r.filter(function(x){
      if(x&&x.slug===slug){ prev=(+x.count)||1; return false; }
      return !!(x&&x.slug);
    });
    r.unshift({slug:slug,ts:Date.now(),count:prev+1});
    lsSet(RECENT_KEY,r.slice(0,RECENT_MAX));
  },
  get:function(){
    var r=lsGet(RECENT_KEY,[]);
    if(!Array.isArray(r)) return [];
    return r.filter(function(x){ return x&&toolBySlug(x.slug); })
      .map(function(x){ return {slug:x.slug,ts:x.ts||0,count:(+x.count)||1}; })
      .slice(0,RECENT_MAX);
  }
};
function slugForHref(h){
  var found=null;
  (window.DKTOOLS||[]).forEach(function(x){ if(x.href===h) found=x.slug; });
  return found;
}
/* Star SVG (fav toggle). Inline so no DKIcons dependency. */
var STAR_SVG='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17l-5.7 3 1.2-6.3L2.8 9.3l6.4-.8z"/></svg>';

function toolItemHTML(tool){
  var badge=tool.badgeKey?'<span class="badge badge-amber">'+esc(t(tool.badgeKey))+"</span>":"";
  var fav=isFav(tool.slug);
  var favLabel=t(fav?"home2.fav_off":"home2.fav_on")+" — "+t(tool.nameKey);
  return '<li class="cat-tool-row"><a class="cat-tool" href="'+esc(tool.href)+'">'
    +'<span class="cat-tool__icon" aria-hidden="true">'+tool.icon+"</span>"
    +'<span class="cat-tool__body">'
    +'<span class="cat-tool__name">'+esc(t(tool.nameKey))+"</span>"
    +'<span class="cat-tool__desc">'+esc(t(tool.descKey))+"</span>"
    +"</span>"+badge
    +'<span class="cat-tool__arrow" aria-hidden="true">\u2192</span>'
    +"</a>"
    +'<button type="button" class="fav-btn'+(fav?" is-fav":"")+'" data-fav="'+esc(tool.slug)+'" aria-pressed="'+(fav?"true":"false")+'" aria-label="'+esc(favLabel)+'">'+STAR_SVG+"</button>"
    +"</li>";
}
function peekNames(cat){
  return cat.tools.map(function(s){ var x=toolBySlug(s); return x?esc(t(x.nameKey)):""; })
    .filter(Boolean).join(" \u00B7 ");
}
function catCardHTML(cat, isOpen){
  var tools=cat.tools.map(toolBySlug).filter(Boolean).sort(toolOrder);
  var items=tools.map(toolItemHTML).join("");
  var open=isOpen?" open":"";
  var exp=isOpen?"true":"false";
  var label=isOpen?t("cat_close"):t("cat_open");
  var pastel=cat.pastel?(" pastel "+cat.pastel):"";
  return '<div class="cat-card'+open+'" data-cat="'+cat.id+'">'
    +'<button type="button" class="cat-head" aria-expanded="'+exp+'" aria-controls="cat-panel-'+cat.id+'" id="cat-btn-'+cat.id+'" aria-label="'+esc(t(cat.titleKey))+" \u2014 "+esc(label)+'">'
    +'<span class="cat-head__icon'+pastel+'" aria-hidden="true">'+cat.icon+"</span>"
    +'<span class="cat-head__text">'
    +'<span class="cat-head__title">'+esc(t(cat.titleKey))+"</span>"
    +'<span class="cat-head__sub">'+esc(t(cat.subKey))+"</span>"
    +'<span class="cat-head__peek" aria-hidden="true">'+peekNames(cat)+"</span>"
    +"</span>"
    +'<span class="cat-head__count"><span aria-hidden="true">'+cat.tools.length+"</span> "+esc(t("cat_n_tools"))+"</span>"
    +'<span class="cat-chevron" aria-hidden="true">\u25BE</span>'
    +"</button>"
    +'<div class="cat-panel" id="cat-panel-'+cat.id+'" role="region" aria-labelledby="cat-btn-'+cat.id+'">'
    +'<div class="cat-panel__inner"><div class="cat-divider" aria-hidden="true"></div>'
    +'<ul class="cat-tools">'+items+"</ul></div></div></div>";
}
function renderCats(openId){
  var list=document.getElementById("catList");
  var empty=document.getElementById("toolsEmpty");
  if(!list) return;
  if(!openId) openId=CATS[0].id; /* first category open by default */
  list.innerHTML=CATS.map(function(c){ return catCardHTML(c, c.id===openId); }).join("");
  list.classList.add("is-bento"); /* bento grid layout (desktop) */
  if(empty) empty.style.display="none";
}
function renderSearch(q){
  var list=document.getElementById("catList");
  var empty=document.getElementById("toolsEmpty");
  if(!list) return;
  list.classList.remove("is-bento"); /* search results stay a simple list */
  var html="", n=0;
  CATS.forEach(function(c){
    var items=c.tools.map(toolBySlug).filter(Boolean).filter(function(x){ return matchTool(x,q); }).sort(toolOrder);
    if(!items.length) return;
    n+=items.length;
    html+='<div class="cat-search-group"><h3><span aria-hidden="true">'+c.icon+"</span> "+esc(t(c.titleKey))+"</h3>"
      +'<ul class="cat-tools">'+items.map(toolItemHTML).join("")+"</ul></div>";
  });
  list.innerHTML=html;
  if(empty) empty.style.display=n===0?"block":"none";
}
function currentQuery(){
  var si=document.getElementById("toolSearch");
  return si?(si.value||"").trim().toLowerCase():"";
}
function currentOpen(){
  var o=document.querySelector("#catList .cat-card.open");
  return o?o.getAttribute("data-cat"):null;
}
function render(){
  var q=currentQuery();
  if(q) renderSearch(q); else renderCats(currentOpen());
  renderRecent();
}
/* ---------- Recently used row (point 47) ----------
   Rendered above the category accordion; hidden when empty or when the user
   is searching. */
function renderRecent(){
  var box=document.getElementById("recentBox");
  if(!box) return;
  var q=currentQuery();
  var items=window.DKRecent.get();
  if(q||!items.length){ box.hidden=true; box.innerHTML=""; return; }
  var chips=items.map(function(r){
    var tool=toolBySlug(r.slug); if(!tool) return "";
    var n=r.count>1?'<span class="recent-chip__n" aria-hidden="true">'+r.count+"\u00D7</span>":"";
    return '<a class="recent-chip" href="'+esc(tool.href)+'"><span aria-hidden="true">'+tool.icon+"</span> "+esc(t(tool.nameKey))+n+"</a>";
  }).join("");
  if(!chips){ box.hidden=true; return; }
  box.hidden=false;
  box.innerHTML='<div class="recent-row"><span class="recent-row__label" data-i18n="home2.recent_t">'+esc(t("home2.recent_t"))+"</span>"+chips+"</div>";
}
/* ---------- Animated typing demo (hero, point 1a) ----------
   Type/delete loop over tool names in a terminal-style card. Static fallback
   under prefers-reduced-motion. Generation counter keeps stale loops from
   surviving a language switch. */
var demoGen=0;
function initDemo(){
  var line=document.getElementById("typeLine");
  if(!line) return;
  var gen=++demoGen;
  var phrases=["home2.demo_p1","home2.demo_p2","home2.demo_p3","home2.demo_p4"].map(function(k){ return t(k); });
  if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches){
    line.textContent=phrases[0];
    return;
  }
  var pi=0, ci=0, del=false;
  function tick(){
    if(gen!==demoGen) return; /* superseded (language switch) */
    var cur=phrases[pi];
    if(!del){
      ci++;
      if(ci>=cur.length){ line.textContent=cur; del=true; setTimeout(tick,1700); return; }
      line.textContent=cur.slice(0,ci);
      setTimeout(tick,50+Math.random()*40);
    }else{
      ci--;
      if(ci<=0){ line.textContent=""; del=false; pi=(pi+1)%phrases.length; setTimeout(tick,450); return; }
      line.textContent=cur.slice(0,ci);
      setTimeout(tick,26);
    }
  }
  tick();
}
/* ---------- Count-up numbers (points 28/46) ----------
   [data-countup="N"] with optional data-prefix / data-suffix. Runs once when
   the element scrolls into view; instant under reduced motion. */
function initCountUp(){
  var els=document.querySelectorAll("[data-countup]");
  if(!els.length) return;
  var reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function run(el){
    var target=parseFloat(el.getAttribute("data-countup"))||0;
    var pre=el.getAttribute("data-prefix")||"", suf=el.getAttribute("data-suffix")||"";
    if(reduced||target===0){ el.textContent=pre+target+suf; return; }
    var dur=1100, start=null;
    function step(ts){
      if(!start) start=ts;
      var p=Math.min(1,(ts-start)/dur), e=1-Math.pow(1-p,3);
      el.textContent=pre+Math.round(target*e)+suf;
      if(p<1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){ run(en.target); io.unobserve(en.target); }
      });
    },{threshold:0.4});
    els.forEach(function(el){ io.observe(el); });
  }else{
    els.forEach(run);
  }
}
/* ---------- First-visit coach hint (point 50) ----------
   Shown once ever (localStorage dk_hint_seen); dismissible. */
function initHint(){
  var h=document.getElementById("searchHint");
  if(!h) return;
  var seen=false;
  try{ seen=window.localStorage.getItem(HINT_KEY)==="1"; }catch(e){}
  if(seen){ h.hidden=true; return; }
  h.hidden=false;
  try{ window.localStorage.setItem(HINT_KEY,"1"); }catch(e){}
  var btn=h.querySelector("[data-hint-close]");
  if(btn) btn.addEventListener("click",function(){ h.hidden=true; });
}
/* ---------- "/" focuses search (point 10) ---------- */
function initSlash(){
  document.addEventListener("keydown",function(e){
    if(e.key!=="/"||e.defaultPrevented) return;
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    var tgt=e.target, tag=(tgt&&tgt.tagName||"").toUpperCase();
    if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||(tgt&&tgt.isContentEditable)) return;
    var si=document.getElementById("toolSearch");
    if(si){ e.preventDefault(); si.focus(); }
  });
}
function initFaq(scope){
  if(!scope) return;
  scope.querySelectorAll(".faq-q").forEach(function(btn){
    btn.addEventListener("click",function(){
      var open=btn.closest(".faq-item").classList.toggle("open");
      btn.setAttribute("aria-expanded",open?"true":"false");
    });
  });
}
document.addEventListener("DOMContentLoaded",function(){
  DKUI.initTheme(); DKUI.renderNav("home"); DKUI.renderFooter(); DKUI.init(); DKI18N.apply();
  render();
  initDemo(); initCountUp(); initHint(); initSlash();
  var si=document.getElementById("toolSearch");
  if(si) si.addEventListener("input",render);
  var list=document.getElementById("catList");
  if(list) list.addEventListener("click",function(ev){
    var btn=ev.target.closest(".cat-head");
    if(!btn||!list.contains(btn)) return;
    var card=btn.closest(".cat-card");
    var wasOpen=card.classList.contains("open");
    list.querySelectorAll(".cat-card").forEach(function(c){
      var b=c.querySelector(".cat-head"); if(!b) return;
      var id=c.getAttribute("data-cat");
      var cfg=null; CATS.forEach(function(x){ if(x.id===id) cfg=x; });
      var willOpen=(c===card)&&!wasOpen;
      c.classList.toggle("open",willOpen);
      b.setAttribute("aria-expanded",willOpen?"true":"false");
      if(cfg) b.setAttribute("aria-label",t(cfg.titleKey)+" \u2014 "+t(willOpen?"cat_close":"cat_open"));
    });

  });
  /* Favorites toggle + recently-used tracking (delegated, alongside accordion).
     Fav clicks never match ".cat-head", so the accordion handler above ignores
     them; the link default is prevented so navigation does not happen. */
  if(list) list.addEventListener("click",function(ev){
    var fb=ev.target.closest(".fav-btn");
    if(fb&&list.contains(fb)){
      ev.preventDefault();
      var slug=fb.getAttribute("data-fav");
      toggleFav(slug);
      render();
      /* restore focus to the re-rendered star so keyboard users don't lose place */
      var nb=list.querySelector('.fav-btn[data-fav="'+slug+'"]');
      if(nb) nb.focus();
      return;
    }
    var a=ev.target.closest("a.cat-tool");
    if(a&&list.contains(a)){
      var s2=slugForHref(a.getAttribute("href"));
      if(s2) window.DKRecent.push(s2);
    }
  });
  var s=DKI18N.setLang;
  DKI18N.setLang=function(l){ s(l); render(); initDemo(); initFaq(document.getElementById("faqTeaser")); DKI18N.refresh(); if(window.DKUI){DKUI.renderNav("home");DKUI.renderFooter();DKUI.initLang();} };
  initFaq(document.getElementById("faqTeaser"));
});
}();
