// ============================================================
// DRILLS DATA - Edit this file to add/update drill content
// ============================================================
//
// Key format: "TOPIC | AGE" (e.g. "A1 | U4", "D6 | U12")
// Topics: A1-A8 (attacking), D1-D6 (defending)
// Ages: U4, U5, U6, U7, U8, U9, U10, U11, U12
//
// Each entry has 4 phases:
//   activation (phase 0) - warm-up exercise
//   drill1 (phase 1) - main drill
//   drill2 (phase 2) - progression
//   drill3 (phase 3) - small-sided game
//
// Fields per phase:
//   title:   drill name
//   desc:    methodology description (use backslash-n for line breaks)
//   image:   OPTIONAL - auto-computed from sequential numbering
//            (TOPIC_N.png where N = ageIndex*4 + phaseIndex)
//            Only set this manually to override the auto-computed path
//   success: success criteria
//   video:   optional - full URL (CapCut or Bilibili)
//
// ============================================================

const DRILLS_DATA = {
  "A1 | U4": {
    age: "U4",
    topic: "A1",
    coach: "Easy",
    activation: {
      title: "Kick the cone",
      desc: "Players trying to kick the cone or pass to a teammate, focussing on:\nBig step, inside foot, balance.",
      success: "All players can play a technical correct inside pass"
    },
    drill1: {
      title: "Great Wall",
      desc: "🟢 1 starts with the ball [feet or hand]. 🔴 9 defends the two goals from behind the wall. 🟢 1 tries to beat 🔴 9 by faking [and using the MOTW].\n\nGoal = 1 point.\nSwitch positions.\nVary width/length.",
      success: "🟢 wins 9 out of 10 times."
    },
    drill2: {
      title: "1V1 GK escaping pressure",
      desc: "🔴 9 rolls the ball to 🟢 1. 🔴 9 runs around the cone and presses the goalkeeper. 🟢 1. Can score on the small goals, [try to] use fakes 🔴 9 can score on the big goal.",
      success: "5 out of 10 can use fakes"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "We start in the hospital and who can do the moves are going to try doing sets of 3-5-10.",
      success: "All players with interest know the 2 moves."
    },
  },
  "A1 | U5": {
    age: "U5",
    topic: "A1",
    coach: "Mia,Easy",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to pass through Passing Gates, focussing on:\nBig step, inside foot, balance.",
      success: "All players can play a technical correct inside pass with an angle"
    },
    drill1: {
      title: "1V1 GK vs Striker",
      desc: "🟢 1 starts with the ball. 🔴 9 defends the two goals. 🟢 1 tries to beat 🔴 9 by faking [and using the MOTW].\n\nGoal = 1 point.\nSwitch positions.\nVary width/length.\nKeep intensity high.",
      success: "🟢 wins 8 out of 10 times."
      ,video: "https://www.capcut.cn/share/7647067494599120190"
    },
    drill2: {
      title: "2V1 escaping pressure",
      desc: "🟢 1 receives the pass from 🔴 and rolls to 🟢 4, or dribbles to score on the small goals, 🔴 9 can score on the big goal.",
      success: "5 out of 10 can apply the steering wheel"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "1. Set of 60 sec\n2. Set of 45 sec\n3. Set of 30 sec\n\nPlayers are allowed to do the moves slowly, but can't make a mistake.",
      success: "Most players can keep doing the sets"
    },
  },
  "A1 | U6": {
    age: "U6",
    topic: "A1",
    coach: "Mia,Relax",
    activation: {
      title: "Passing Gates competition [7-8M]",
      desc: "Players trying to pass through Passing Gates, focussing on:\nBig step, inside foot, balance.\nCompetition/tournament should results in direction and speed.\nWinners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "2V1 GK+1 vs Striker",
      desc: "🟢 1 starts with the ball. Together with 🟢 3, they try to beat 🔴 9, who defends the two goals. 🟢 score by passing or dribbling through the small goal/gates. 🔴 9 can score on the big goal.\n\nGoal = 1 point.\nSwitch positions.\nVary width/length.\nKeep intensity high.",
      success: "🟢 wins 7 out of 10 times."
    },
    drill2: {
      title: "3v1 from GK > 3V2 SSG",
      desc: "🟢 1 starts the 3v1. 🔴 Players may only steal the ball after crossing line. 🟢 can score on the small goal, 🔴 9 can score on the big goal. When the ball is out of play, 🔴 3 starts the 2nd ball [3V2 SSG]",
      success: "All can apply the steering wheel, 5 out of 10 really understand it"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "2 Set of 40 sec\n2 Set of 30 sec\n2 Set of 20 sec\n\nPlayers are allowed to do the moves slowly, but can't make a mistake.",
      success: "All players can do sets with move combinations"
    },
  },
  "A1 | U7": {
    age: "U7",
    topic: "A1",
    coach: "Mia,Relax",
    activation: {
      title: "Passing Gates 7-8M",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:\nBig step, inside foot, balance.\nNo bouncing balls\nCompetition/tournament should results in direction and speed.\nWinners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "2V1 GK+1 vs Striker",
      desc: "🟢 1 starts with the ball. Together with 🟢 3, they try to beat 🔴 9, who defends the two goals. 🟢 score by passing or dribbling through the small goal/gates. 🔴 9 can score on the big goal.\n\nGoal = 1 point.\nSwitch positions.\nVary width/length.\nKeep intensity high.",
      success: "🟢 wins 7 out of 10 times."
    },
    drill2: {
      title: "3v2 from GK > 3V3 SSG",
      desc: "🟢 1 starts the 3v2. 🔴 Players may only steal the ball after crossing line. 🟢 can score on the big goal, 🔴 can score on the big goal. When the ball is out of play, 🔴 3 starts the 2nd ball [3V3 SSG]",
      success: "The steering wheel is very active all the time."
    },
    drill3: {
      title: "Pull open/V's",
      desc: "2 Set of 40 sec\n2 Set of 30 sec\n2 Set of 20 sec",
      success: "All players can do sets with move combinations"
    },
  },
  "A1 | U8": {
    age: "U8",
    topic: "A1",
    coach: "Roger,Rico",
    activation: {
      title: "Passing Gates 8-10M",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:\nBig step, inside foot, balance.\nNo bouncing balls\nCompetition/tournament should results in direction and speed.\nWinners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "3v2 from GK",
      desc: "🟢 1 starts with the ball. Together with 🟢 3, they try to beat 🔴 who defends the two goals. 🟢 can score on the big goal or by dribbling through the gates. 🔴 9 can score on the big goal.\n\nGoal = 1 point.\nSwitch positions.\nVary width/length.\nKeep intensity high.",
      success: "🟢 wins 5 out of 10 times."
    },
    drill2: {
      title: "3v3 from GK > 3V4 SSG",
      desc: "🟢 1 starts the 3v3 under full pressure from 🔴 9. 🔴 7 can only defend on their own half. When the ball is out of play, 🔴 3 starts the 2nd ball [3V4 SSG]",
      success: "🟢Can enter their half"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "5 Set of 30 sec\non high intensity move combinations",
      success: "All players can do sets with move combinations"
    },
  },
  "A1 | U10": {
    age: "U10",
    topic: "A1",
    coach: "Nikola,Lance",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:\nBig step, inside foot, balance.\nNo bouncing balls\nCompetition/tournament should results in direction and speed.\nWinners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "5v3 SSG",
      desc: "A small-sided game designed to improve building out from the goalkeeper under pressure. The possession team (5 players) aims to complete a set number of passes to score, while the defending team (3 players) tries to win the ball and score in the goal. Focus is on positioning, creating passing angles, body shape, and decision-making in the build-up phase.",
      success: "Crossing the middle (green zone) line and start from (GK) again"
    },
    drill2: {
      title: "8v6 SSG",
      desc: "An 8v6 game focused on building possession from the goalkeeper and progressing the ball through the thirds. The team in possession must create passing angles, maintain width and depth, and find opportunities to play forward beyond the opposition's pressure. Defenders aim to win the ball and transition quickly to goal. The exercise develops positioning, decision-making, communication, and confidence when building out from the back under realistic match pressure.",
      success: "Crossing the middle (green zone) is a priority and if the green team score a goal is a extra point"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "High intensity move combinations",
      success: "All players can do sets with move combinations"
    },
  },
  "A1 | U11": {
    age: "U11",
    topic: "A1",
    coach: "Ti,Rash,Relax",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:\nBig step, inside foot, balance.\nNo bouncing balls\nCompetition/tournament should results in direction and speed.\nWinners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "1v1 for CD",
      desc: "🟢 Centre-defenders learns to get out of pressure. Improve individual dribbling, scanning, and decision-making under pressure in a 1v1. If 🟢 loses the ball, 🔴 earns a point. If 🟢 dribbles 🔴 successfully, 🟢 earns a point.",
      success: "CD get out of pressure 6 out of 10 times"
    },
    drill2: {
      title: "6v5 SSG",
      desc: "🟢 Builds up from the goalkeeper and must cross the marked zone to score. 🔴 tries to win the ball and score.\nMethodology:\nincrease/decrease field size;\nadd/remove a player",
      success: "🟢 Can enter their half by finding +1"
    },
    drill3: {
      title: "3v3 + N",
      desc: "3v3 with neutral player. Both teams always start from their GK. Learn how to build-up and get out of the initial pressure to score goal.\nModifications: Increase/decrease space. Limit the Neutral player or GK touches.",
      success: "Players are confident in the small side game situations to find passing angles or dribbling spaces to build-up and initiate attacks most of the time."
    },
  },
  "A1 | U12": {
    age: "U12",
    topic: "A1",
    coach: "",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:\nBig step, inside foot, balance.\nNo bouncing balls\nCompetition/tournament should results in direction and speed.\nWinners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "1v1 for CD",
      desc: "🟢 Centre-defenders learns to get out of pressure. Improve individual dribbling, scanning, and decision-making under pressure in a 1v1. If 🟢 loses the ball, 🔴 earns a point. If 🟢 dribbles 🔴 successfully, 🟢 earns a point.",
      success: "CD get out of pressure 6 out of 10 times"
    },
    drill2: {
      title: "6v5 SSG",
      desc: "🟢 Builds up from the goalkeeper and must cross the marked zone to score. 🔴 tries to win the ball and score.\nMethodology:\nincrease/decrease field size;\nadd/remove a player",
      success: "🟢 Can enter their half by finding +1"
    },
    drill3: {
      title: "3v3 + N",
      desc: "3v3 with neutral player. Both teams always start from their GK. Learn how to build-up and get out of the initial pressure to score goal.\nModifications: Increase/decrease space. Limit the Neutral player or GK touches.",
      success: "Players are confident in the small side game situations to find passing angles or dribbling spaces to build-up and initiate attacks most of the time."
    },
  },
};