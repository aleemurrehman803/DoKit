/* ============================================================
   TypeMaster — test-data.js : timed-test passages
   ALL passages are ORIGINAL, written for TypeMaster.
   ============================================================ */

const TEST_CATALOG = {
standard: [
 { id:"easy", name:"Easy Text", desc:"Short, simple everyday words.", text:
  "The cat sat on the warm rug by the door. A dog ran past the big red barn. " +
  "We had hot soup for lunch and then went out to play in the soft green grass. " +
  "Mom sang a sweet song while dad read the news in his old brown chair." },
 { id:"medium", name:"Medium Text", desc:"Natural sentences with varied vocabulary.", text:
  "Learning to type quickly takes patience and daily practice, but the reward is worth every minute you invest. " +
  "When your fingers know where each key lives, your thoughts can flow straight onto the screen without interruption. " +
  "Start slowly and focus on accuracy first; speed will follow naturally as your muscle memory grows stronger each week. " +
  "Many students are surprised by how fast they improve once they stop looking down at their hands. " +
  "Set a small daily goal, track your words per minute, and celebrate every new personal record you achieve." },
 { id:"hard", name:"Hard Text", desc:"Longer, denser prose with complex words.", text:
  "The expedition set out before dawn, crossing the misty valley toward mountains that rose like silent giants against the brightening sky. " +
  "Every traveler carried provisions, instruments, and a quiet determination to document whatever wonders the uncharted territory might reveal. " +
  "By midday the weather shifted unexpectedly; dark clouds gathered overhead and a cold wind swept through the narrow pass, forcing the group to seek shelter beneath an overhanging cliff. " +
  "While they waited, the expedition leader reviewed their charts, recalculated distances, and encouraged everyone with stories of previous journeys that had survived far worse conditions. " +
  "When the storm finally passed, sunlight broke through in brilliant shafts, transforming the wet landscape into a glittering panorama that made every hardship feel worthwhile. " +
  "They pressed onward with renewed energy, reaching the summit just as evening painted the horizon in shades of amber and rose." },
 { id:"benchmark", name:"Benchmark", desc:"The standard TypeMaster measure.", text:
  "Typing speed is measured in words per minute, where each word counts as five characters including spaces and punctuation marks. " +
  "Most beginners start around twenty words per minute, while experienced typists comfortably exceed sixty with high accuracy. " +
  "Professional transcriptionists often reach ninety or more, a pace that requires years of deliberate practice to maintain. " +
  "This benchmark text gives you a fair, balanced sample of common English to measure your true current speed. " +
  "Relax your shoulders, keep your wrists straight, and type at a steady rhythm without rushing through difficult words." }
],
advanced: [
 { id:"tricky", name:"Tricky Spelling", desc:"Words that love to trip you up.", text:
  "The embarrassed committee definitely decided to accommodate the necessary occurrence, despite the weird seizure of excitement. " +
  "A conscientious colleague carefully separated forty pairs of scissors while rhythmically humming through the queue. " +
  "Maintenance on the fluorescent lightning rod was scheduled for February, though its existence remained questionable. " +
  "She misspelled embarrassment, broccoli, and vacuum in a single paragraph, then laughed at her own perseverance. " +
  "Occasionally, even excellent spellers hesitate over liaison, zucchini, and the truly troublesome onomatopoeia." },
 { id:"blind", name:"Blind Typing", desc:"Your typed letters are hidden — trust your fingers.", blind:true, text:
  "Close your eyes to doubt and let your fingers find their way across the familiar keyboard landscape. " +
  "You have practiced these motions hundreds of times; the letters are exactly where your memory expects them to be. " +
  "Breathe steadily, keep a gentle rhythm, and resist the urge to peek at what you have written. " +
  "Mistakes are welcome here because they reveal which keys still need your attention and care." },
 { id:"story", name:"Story Typing", desc:"A short original tale to type.", text:
  "Mira found the brass key beneath the old willow on the morning of her tenth birthday. " +
  "It was warm, as if someone had just been holding it, though the garden stood empty and silent. " +
  "That evening she tried it in every lock in the house until, at last, the attic door clicked open. " +
  "Inside, dust floated in moonbeams above a small wooden chest carved with stars. " +
  "She lifted the lid slowly, half afraid of what she might find waiting in the dark." }
],
professional: [
 { id:"certificate", name:"Certificate", desc:"Formal text for certification runs.", text:
  "This is to certify that the bearer has successfully completed the TypeMaster Professional Typing Assessment, demonstrating " +
  "a sustained typing speed and accuracy consistent with professional office standards. The assessment covered continuous prose, " +
  "business correspondence, and data entry formats under timed conditions. Candidates are evaluated on gross words per minute, " +
  "net words per minute, and overall accuracy. A minimum accuracy of ninety-five percent is required for certification at the professional level." },
 { id:"legal", name:"Legal", desc:"Contract-style formal language.", text:
  "The parties hereby agree that all confidential information disclosed during the term of this agreement shall remain strictly " +
  "protected and shall not be revealed to any third party without prior written consent. Any breach of this provision shall entitle " +
  "the disclosing party to seek immediate injunctive relief in addition to any other remedies available under applicable law. " +
  "This agreement shall remain in full force for a period of three years from the effective date specified herein." },
 { id:"medical", name:"Medical", desc:"Clinical vocabulary and phrasing.", text:
  "The patient presented with mild hypertension and was prescribed a daily regimen of medication alongside recommended dietary adjustments. " +
  "Blood pressure was recorded at one forty over ninety, with a resting heart rate of seventy-two beats per minute. " +
  "The attending physician noted improved cardiovascular response following six weeks of monitored aerobic exercise. " +
  "Follow-up evaluation is scheduled in three months to assess continued progress and adjust treatment as necessary." },
 { id:"business", name:"Business", desc:"Reports, email and meeting language.", text:
  "Dear team, please find attached the quarterly performance report for your review ahead of Thursday's strategy meeting. " +
  "Revenue grew twelve percent compared to the previous quarter, driven primarily by strong results in our enterprise segment. " +
  "We propose reallocating part of the marketing budget toward customer retention, which shows the highest return on investment. " +
  "Kindly confirm your availability and share any agenda items by Wednesday afternoon. Best regards." },
 { id:"coding", name:"Coding", desc:"Code-flavored text with symbols.", text:
  "function calculateWPM(chars, minutes) { return (chars / 5) / minutes; } // words per minute " +
  "const user = { name: 'Alex', score: 95, active: true }; if (user.active && user.score >= 90) { console.log('pass'); } " +
  "for (let i = 0; i < 10; i++) { total += data[i] * 1.5; } /* loop complete */ => done!" }
]
};

function getTest(cat, id) {
  const arr = TEST_CATALOG[cat] || [];
  return arr.find(t => t.id === id) || null;
}
function testCategories() { return Object.keys(TEST_CATALOG); }
