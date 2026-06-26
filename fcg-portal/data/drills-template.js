// ============================================================
// DRILLS TEMPLATE - Copy this to add a new topic's drill data
// ============================================================
//
// HOW TO USE:
// 1. Copy the entire block for one age group below
// 2. Change the key from "A2 | U4" to your topic and age
// 3. Fill in the title, desc, success, and video fields
// 4. Paste it into drills.js (inside the DRILLS_DATA object)
// 5. Upload your drill images to img/drills/{TOPIC}/ (see naming below)
//
// IMAGE NAMING (SEQUENTIAL - no renaming needed!):
//   Images go in: img/drills/{TOPIC}/ folder
//   Named: {TOPIC}_{NUMBER}.png
//   The code auto-computes which image goes where.
//
//   Number = ageIndex * 4 + phaseIndex
//   ageIndex: U4=0, U5=1, U6=2, U7=3, U8=4, U9=5, U10=6, U11=7, U12=8
//   phaseIndex: activation=0, drill1=1, drill2=2, drill3=3
//
//   So for topic A2:
//     U4 activation = A2_0.png,  drill1 = A2_1.png,  drill2 = A2_2.png,  drill3 = A2_3.png
//     U5 activation = A2_4.png,  drill1 = A2_5.png,  drill2 = A2_6.png,  drill3 = A2_7.png
//     U6 activation = A2_8.png,  drill1 = A2_9.png,  drill2 = A2_10.png, drill3 = A2_11.png
//     ...and so on for U7, U8, U9, U10, U11, U12
//
//   Just export your images in order and name them sequentially!
//   No need to set the image field in the data - it's automatic.
//
// VIDEO:
//   Paste the full URL from CapCut or Bilibili into the video field
//   CapCut:   https://www.capcut.cn/share/XXXXXXXX
//   Bilibili: https://www.bilibili.com/video/BVXXXXXXXX
//   The video field is OPTIONAL - leave it out if no video
//
// GAMEPLAN IMAGE:
//   Upload to img/gameplans/{TOPIC}/{TOPIC}-{STYLE}.png
//   STYLE depends on age: U4-U5=3v3, U6-U7=5v5, U8-U9=7v7,
//   U10=8v8-1, U11-U12=8v8-2
//   Example: img/gameplans/A2/A2-5v5.png (for U6 or U7)
//
// ============================================================

// --- Example: Topic A2 (Build up) for U4 (3v3) ---
// Note: NO image field needed - it's auto-computed!

  "A2 | U4": {
    age: "U4",
    topic: "A2",
    coach: "Easy",
    activation: {
      title: "Example activation exercise",
      desc: "Description of the warm-up exercise.\nUse line breaks for readability.",
      success: "What success looks like for this exercise"
    },
    drill1: {
      title: "Main drill name",
      desc: "Detailed description of the drill.\nSetup, rules, and coaching points.",
      success: "Success criteria for this drill",
      video: "https://www.capcut.cn/share/YOUR_VIDEO_ID"
    },
    drill2: {
      title: "Progression drill name",
      desc: "Progression that adds pressure or complexity.",
      success: "Success criteria"
    },
    drill3: {
      title: "Small-sided game name",
      desc: "SSG that applies the skill in a game context.",
      success: "Success criteria"
    }
  },

// --- Add one block per age group (U4, U5, U6, U7, U8, U9, U10, U11, U12) ---
// --- Repeat for each topic (A1-A8, D1-D6) that has drill data ---
