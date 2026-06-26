// ============================================================
// DRILLS TEMPLATE - Copy this to add a new topic's drill data
// ============================================================
//
// HOW TO USE:
// 1. Copy the entire block for one age group below
// 2. Change the key from "A2 | U4" to your topic and age
// 3. Fill in the title, desc, image, success, and video fields
// 4. Paste it into drills.js (inside the DRILLS_DATA object)
// 5. Upload your drill images to img/drills/ with matching names
//
// IMAGE NAMING:
//   img/drills/{TOPIC}_{AGE}_{PHASE}.png
//   PHASE: 0 = activation, 1 = drill1, 2 = drill2, 3 = drill3
//   Example: img/drills/A2_U6_0.png
//
// VIDEO:
//   Paste the full URL from CapCut or Bilibili into the video field
//   CapCut:   https://www.capcut.cn/share/XXXXXXXX
//   Bilibili: https://www.bilibili.com/video/BVXXXXXXXX
//   The video field is OPTIONAL - leave it out if no video
//
// GAMEPLAN IMAGE:
//   Upload to img/{TOPIC}-{STYLE}.png (top level img/ folder)
//   STYLE depends on age: U4-U5=3v3, U6-U7=5v5, U8-U9=7v7,
//   U10=8v8-1, U11-U12=8v8-2
//   Example: img/A2-5v5.png (for U6 or U7)
//
// ============================================================

// --- Example: Topic A2 (Build up) for U4 (3v3) ---

  "A2 | U4": {
    age: "U4",
    topic: "A2",
    coach: "Easy",
    activation: {
      title: "Example activation exercise",
      desc: "Description of the warm-up exercise.\nUse line breaks for readability.",
      image: "img/drills/A2_U4_0.png",
      success: "What success looks like for this exercise"
    },
    drill1: {
      title: "Main drill name",
      desc: "Detailed description of the drill.\nSetup, rules, and coaching points.",
      image: "img/drills/A2_U4_1.png",
      success: "Success criteria for this drill",
      video: "https://www.capcut.cn/share/YOUR_VIDEO_ID"
    },
    drill2: {
      title: "Progression drill name",
      desc: "Progression that adds pressure or complexity.",
      image: "img/drills/A2_U4_2.png",
      success: "Success criteria"
    },
    drill3: {
      title: "Small-sided game name",
      desc: "SSG that applies the skill in a game context.",
      image: "img/drills/A2_U4_3.png",
      success: "Success criteria"
    }
  },

// --- Add one block per age group (U4, U5, U6, U7, U8, U9, U10, U11, U12) ---
// --- Repeat for each topic (A1-A8, D1-D6) that has drill data ---
