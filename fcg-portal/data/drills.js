// ============================================================
// DRILLS DATA - Auto-synced from Tencent Docs sheet
// ============================================================
// Source: W17-Spring 2026 (https://docs.qq.com/sheet/DREZwVUVMemRRVGNu)
// Last updated: 2026-06-26
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
//   desc:    methodology description (use \n for line breaks)
//   success: success criteria
//   video:   optional - full URL (CapCut or Bilibili)
//
// Image paths are auto-computed from sequential numbering:
//   img/drills/{TOPIC}/{TOPIC}_{NUMBER}.png
//   NUMBER = ageIndex * 4 + phaseIndex
//
// ============================================================

const DRILLS_DATA = {
  "A1 | U4": {
    age: "U4",
    topic: "A1",
    coach: "Easy",
    activation: {
      title: "Kick the cone",
      desc: "Players trying to kick the cone or pass to a teammate, focussing on:Big step, inside foot, balance.",
      success: "All players can play a technical correct inside pass"
    },
    drill1: {
      title: "Great Wall",
      desc: "🟢 1 starts with the ball [feet or hand]. 🔴 9 defends the two goals from behind the wall. 🟢 1 tries to beat  🔴 9  by faking [and using the MOTW].Goal = 1 point. Switch positions. Vary width/length.",
      success: "🟢 wins 9 out of 10 times."
    },
    drill2: {
      title: "1V1 GK escaping pressure",
      desc: "🔴 9 rolls the ball to 🟢 1. 🔴 9  runs around the cone and presses the goalkeeper. 🟢 1. Can  score on the small goals, [try to] use fakes 🔴 9 can score on the big goal.",
      success: "5 out of 10 can use fakes"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "We start in the hospital and who can do the moves are going to try doing sets of 3-5-10.",
      success: "All players with interest know the 2 moves."
    },
    video: "https://www.capcut.cn/share/7655536914350658840"
  },
  "A1 | U5": {
    age: "U5",
    topic: "A1",
    coach: "Mia,Easy",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to pass through Passing Gates, focussing on:Big step, inside foot, balance.",
      success: "All players can play a technical correct inside pass with an angle"
    },
    drill1: {
      title: "1V1 GK vs Striker",
      desc: "🟢 1 starts with the ball. 🔴 9 defends the two goals. 🟢 1 tries to beat 🔴 9 by faking [and using the MOTW].Goal = 1 point. Switch positions. Vary width/length.Keep intensity high.",
      success: "🟢 wins 8 out of 10 times."
    },
    drill2: {
      title: "2V1 escaping pressure",
      desc: "🟢 1 receives the pass from 🔴  and rolls to 🟢 4, or dribbles to score on the small goals, 🔴 9 can score on the big goal.",
      success: "5 out of 10 can apply the steering wheel"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "1. Set of 60 sec2. Set of 45 sec3. Set of 30 secPlayers are allowed to do the moves slowly, but can't make a mistake.",
      success: "Most players can keep doing the sets"
    },
    video: "https://www.capcut.cn/share/7655536914350658840"
  },
  "A1 | U6": {
    age: "U6",
    topic: "A1",
    coach: "Mia,Relax",
    activation: {
      title: "Passing Gates competition [7-8M]",
      desc: "Players trying to pass through Passing Gates, focussing on:Big step, inside foot, balance.Competition/tournament should results in direction and speed.Winners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "2V1 GK+1 vs Striker",
      desc: "🟢 1 starts with the ball. Together with 🟢 3, they try to beat 🔴 9, who defends the two goals. 🟢 score by passing or dribbling through the small goal/gates. 🔴 9 can score on the big goal.Goal = 1 point. Switch positions. Vary width/length.Keep intensity high.",
      success: "🟢 wins 7 out of 10 times."
    },
    drill2: {
      title: "3v1 from GK > 3V2 SSG",
      desc: "🟢 1 starts the 3v1. 🔴 Players may only steal the ball after crossing line. 🟢 can  score on the small goal, 🔴 9 can score on the big goal. When the ball is out of play, 🔴 3 starts the 2nd ball [3V2 SSG]",
      success: "All can apply the steering wheel, 5 out of 10 really understand it"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "2 Set of 40 sec2 Set of 30 sec2 Set of 20 secPlayers are allowed to do the moves slowly, but can't make a mistake.",
      success: "All players can do sets with move combinations"
    },
    video: "https://www.capcut.cn/share/7655173956030272792"
  },
  "A1 | U7": {
    age: "U7",
    topic: "A1",
    coach: "Mia,Relax",
    activation: {
      title: "Passing Gates 7-8M",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:Big step, inside foot, balance.No bouncing ballsCompetition/tournament should results in direction and speed.Winners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "2V1 GK+1 vs Striker",
      desc: "🟢 1 starts with the ball. Together with 🟢 3, they try to beat 🔴 9, who defends the two goals. 🟢 score by passing or dribbling through the small goal/gates. 🔴 9 can score on the big goal.Goal = 1 point. Switch positions. Vary width/length.Keep intensity high.",
      success: "🟢 wins 7 out of 10 times."
    },
    drill2: {
      title: "3v2 from GK > 3V3 SSG",
      desc: "🟢 1 starts the 3v2. 🔴 Players may only steal the ball after crossing line. 🟢 can  score on the big goal, 🔴 can score on the big goal. When the ball is out of play, 🔴 3 starts the 2nd ball [3V3 SSG]",
      success: "The steering wheel is very active all the time."
    },
    drill3: {
      title: "Pull open/V's",
      desc: "2 Set of 40 sec2 Set of 30 sec2 Set of 20 sec",
      success: "All players can do sets with move combinations"
    },
    video: "https://www.capcut.cn/share/7655173956030272792"
  },
  "A1 | U8": {
    age: "U8",
    topic: "A1",
    coach: "Roger,Rico",
    activation: {
      title: "Passing Gates 8-10M",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:Big step, inside foot, balance.No bouncing ballsCompetition/tournament should results in direction and speed.Winners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "3v2 from GK",
      desc: "🟢 1 starts with the ball. Together with 🟢 3, they try to beat 🔴  who defends the two goals. 🟢 can score on the big goal or by dribbling through the gates. 🔴 9 can score on the big goal.Goal = 1 point. Switch positions. Vary width/length.Keep intensity high.",
      success: "🟢 wins 5 out of 10 times."
    },
    drill2: {
      title: "3v3 from GK > 3V4 SSG",
      desc: "🟢 1 starts the 3v3 under full pressure from 🔴 9.  🔴 7 can only defend on their own half. When the ball is out of play, 🔴 3 starts the 2nd ball [3V4 SSG]",
      success: "🟢Can enter their half"
    },
    drill3: {
      title: "Pull open/V's",
      desc: "5 Set of 30 secon high intensity move combinations",
      success: "All players can do sets with move combinations"
    },
  },
  "A1 | U9": {
    age: "U9",
    topic: "A1",
    coach: "",
    activation: {
      title: "Passing Gates 10M-12M",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:Big step, inside foot, balance.No bouncing ballsCompetition/tournament should results in direction and speed.Winners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill2: {
      title: "2v1-3v3",
      desc: "⒈#10 passes to #1, #9 press immediately- both sides start at the same time⒉Offside rule⒊Only shoot after crossing the center line",
      success: "When out of pressure, move the ball forward faster, then creates a 2v1 situation with midfielder and score more goals"
    },
    drill3: {
      title: "Build up from GK with 3 zone",
      desc: "1. Zone 1 3v2 Play one split pass past 2 red players to the zone 2 G10.2 red players do a head roll2. Coach starts every new round",
      success: "D3-4"
    },
  },
  "A1 | U10": {
    age: "U10",
    topic: "A1",
    coach: "",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:Big step, inside foot, balance.No bouncing ballsCompetition/tournament should results in direction and speed.Winners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "5v3 SSG",
      desc: "A small-sided game designed to improve building out from the goalkeeper under pressure. The possession team (5 players) aims to complete a set number of passes to score, while the defending team (3 players) tries to win the ball and score in the goal. Focus is on positioning, creating passing angles, body shape, and decision-making in the build-up phase.",
      success: "Crossing the middle ( green zone ) line and start from ( GK ) again"
    },
    drill2: {
      title: "8v6 SSG",
      desc: "An 8v6 game focused on building possession from the goalkeeper and progressing the ball through the thirds. The team in possession must create passing angles, maintain width and depth, and find opportunities to play forward beyond the opposition’s pressure. Defenders aim to win the ball and transition quickly to goal. The exercise develops positioning, decision-making, communication, and confidence when building out from the back under realistic match pressure.",
      success: "Crossing the middle ( green zone) is a priority and if the green team score a goal is a extra point"
    },
  },
  "A1 | U11": {
    age: "U11",
    topic: "A1",
    coach: "",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:Big step, inside foot, balance.No bouncing ballsCompetition/tournament should results in direction and speed.Winners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "1v1 for CD",
      desc: "🟢 Centre-defenders learns to get out of pressure. Improve individual dribbling, scanning, and decision-making under pressure in a 1v1. If 🟢 loses the ball, 🔴 earns a point. If 🟢 dribbles 🔴 successfully, 🟢 earns a point.",
      success: "CD get out of pressure 6 out of 10 times"
    },
    drill2: {
      title: "6v5 SSG",
      desc: "🟢 Builds up from the goalkeeper and must cross the marked zone to score. 🔴 tries to win the ball and score.Methodology: increase/decrease field size; add/remove a player",
      success: "🟢 Can enter their half by finding +1"
    },
    drill3: {
      title: "3v3 + N",
      desc: "3v3 with neutral player. Both teams always start from their GK. Learn how to build-up and get out of the initial pressure to score goal. Modifications: Increase/decrease space. Limit the Neutral player or GK touches.",
      success: "Players are confident in the small side game situations to find passing angles or dribbling spaces to build-up and initiate attacks most of the time."
    },
  },
  "A1 | U12": {
    age: "U12",
    topic: "A1",
    coach: "",
    activation: {
      title: "Passing Gates",
      desc: "Players trying to play clean passes through Passing Gates, focussing on:Big step, inside foot, balance.No bouncing ballsCompetition/tournament should results in direction and speed.Winners up, loosers down.",
      success: "All players can pass technical correct, inside foot with angle and intensity"
    },
    drill1: {
      title: "1v1 for CD",
      desc: "🟢 Centre-defenders learns to get out of pressure. Improve individual dribbling, scanning, and decision-making under pressure in a 1v1. If 🟢 loses the ball, 🔴 earns a point. If 🟢 dribbles 🔴 successfully, 🟢 earns a point.",
      success: "CD get out of pressure 6 out of 10 times"
    },
    drill2: {
      title: "6v5 SSG",
      desc: "🟢 Builds up from the goalkeeper and must cross the marked zone to score. 🔴 tries to win the ball and score.Methodology: increase/decrease field size; add/remove a player",
      success: "🟢 Can enter their half by finding +1"
    },
    drill3: {
      title: "3v3 + N",
      desc: "3v3 with neutral player. Both teams always start from their GK. Learn how to build-up and get out of the initial pressure to score goal. Modifications: Increase/decrease space. Limit the Neutral player or GK touches.",
      success: "Players are confident in the small side game situations to find passing angles or dribbling spaces to build-up and initiate attacks most of the time."
    },
  },
  "A7 | U4": {
    age: "U4",
    topic: "A7",
    coach: "",
    activation: {
      title: "Stealing cones [Jungle game]",
      desc: "Dribble inside the square, steal a cone and dribble back to your base. Dont let the \"monkey in the jungle\" get your ball.Harder: play without cones, and try  to go inside the square and turn around or chose a new base.",
      success: "Be active, dare to steal cones and evade the monkey."
    },
  },
  "A7 | U5": {
    age: "U5",
    topic: "A7",
    coach: "",
    activation: {
      title: "Moves in the square",
      desc: "There is a monkey in the middle, who will try to catch your ball. The players in the team execute the moves of the week without getting caught. Harder: Take the monkey out. Demand accelleration, the ball is not allowed to stop. Go to the new direction ordered by the coach.",
      success: "Scissors, stepover and sidesteps, then able to find the direction"
    },
  },
  "A7 | U6": {
    age: "U6",
    topic: "A7",
    coach: "",
    activation: {
      title: "Moves in the square",
      desc: "We start with a 5x5 square meter square and a simple move going with 4 players to gether in the same direction. We alternate the moves and demand more accelleration. Then we make the space even smaller.",
      success: "Combination of moves in combination with the right direction as follow up."
    },
  },
  "A8 | U4": {
    age: "U4",
    topic: "A8",
    coach: "Easy",
    activation: {
      title: "Stop and go -- Bounce shoot",
      desc: "Open space: 5 Toe-taps and in-in's at each cone - Learning the S&G.- Combine it with stepover and scissorsBounce shoot: Throw, speed up, and score on the goal.+ With goalkeeper+ Limited bounces up to 3.",
      success: "\"hops\" for S&G but also for shooting"
    },
    drill1: {
      title: "Score and defend",
      desc: "🟢7 dribbles quickly to goal and scores. Then line up at the other side.When players start to understand how to react, we 🟢11 scores from a cross. And 🔴7 starts to defend \"stopping the car\", which is ball 2.",
      success: "React to ball 2 without help"
    },
    drill2: {
      title: "Bounce bounce shoot",
      desc: "After scoring from the cross by coach, ball 2 by 🟢11 is a 2v1 situation. Dribble or pass is the decision to be made.",
      success: "Toes are pointed down while making a jump"
    },
    drill3: {
      title: "Shoot from the cone",
      desc: "Combination of quick drillsPut the ball on the cone: small steps, big last step, toes pointed down, and make a magic jump.Practice stop and goes 1v0 and 1v1 in the open space.",
      success: "When drills can start in half a minute and last shorter due to high intensity"
    },
    video: "https://www.capcut.cn/share/7647067494599120190"
  },
  "A8 | U5": {
    age: "U5",
    topic: "A8",
    coach: "Mia,Easy",
    activation: {
      title: "Bounce shoot",
      desc: "Throw, fast run, and jump to score.+ With goalkeeper+ Limited bounces to 4-3-2 and increase the distance for shooting.+ Combine them with dribble+shot in a small angle.",
      success: "Score 5 goals in 90 seconds"
    },
    drill1: {
      title: "Cross and finish",
      desc: "After🟢11 stops the ball at the cone,🔴7 is starting to defend.🟢7 gives the cross to 🟢11 and prepares a new ball for the next player.🟢11 and 🔴7 compete for the second ball.🔴7  must have been inside the box upon going for ball 2.",
      success: "When more than 50% of the cross arrives at  🟢11"
    },
    drill2: {
      title: "2v1 - 2v2 Transition",
      desc: "🟢11 speed dribbles and finds a cross to 🟢7.🔴7 has to run behind the back of🟢11 and gets a point when being able to block the cross.Ball 2 by🔴11 speed dribbling the second ball in transition.",
      success: "The first cross has a success rate of >50%"
    },
    drill3: {
      title: "S&G in open space",
      desc: "S&G with acceleration in sets of 10 or 20/60 sec depending on the intensity. Increase intensity during the week.",
      success: "Combine a stop and go with a scissors or stepover"
    },
    video: "https://www.capcut.cn/share/7647067494599120190"
  },
  "A8 | U6": {
    age: "U6",
    topic: "A8",
    coach: "Mia,Relax",
    activation: {
      title: "Push, turn and pass",
      desc: "Get balls quickly in the goal [less touches is better] after going around the ball and put a big step next to the ball.- Increase the angle and distance of the goal for extra difficulty. Can be done on one side only.",
      success: "Speed and direction of the cross looks dynamic"
    },
    drill1: {
      title: "Dribble, cross and finish",
      desc: "🟢7 speed dribbles, crosses to 🟢11 and sprints to ball 2.🟢11 stops the ball at the cone, then🔴7 starts to defend the cross from ball 1.- Defenders are not allowed to \"cheat\"- Dribble distance adjusted increase successrate",
      success: "When >66% of the first cross is being shot."
    },
    drill2: {
      title: "3v2 - 3v3 Transition",
      desc: "🟢11 speed dribbles and finds a cross to 🟢7.🔴7 has to run behind the back of🟢11 and gets a point when being able to block the cross.Ball 2 by🔴11 who crosses or does a S&G upon scoring.",
      success: "Speed dribbling on the wing to create time is understood by >90%"
    },
    drill3: {
      title: "S&G in squares",
      desc: "S&G with 100% acceleration in sets of 10 [50 sec]. Increase intensity > Increase duration during the week.+ Combine S&G with change of direction",
      success: "[45 Sec] S&G with 100% acceleration without colliding"
    },
    video: "https://www.capcut.cn/share/7647067494599120190"
  },
  "A8 | U7": {
    age: "U7",
    topic: "A8",
    coach: "Mia,Relax",
    activation: {
      title: "Speed on the wing and cross",
      desc: "Get the ball in the goal by using only 2 touches and also try to include left foot as well.- Distance of the goal can be adjusted.- Include a S&G to alternate.- Become a defender after finishing [reaction time]",
      success: "Majority show quality [speed of execution and accuracy]"
    },
    drill1: {
      title: "Dribble, cross and finish",
      desc: "🟢7 speed dribbles, crosses to 🟢11 and sprints to ball 2.🟢11 stops the ball at the cone, then🔴7 starts to defend the cross from ball 1.",
      success: "First cross is a slightly back-passed by >50%"
    },
    drill2: {
      title: "3v2 - 3v3 Transition",
      desc: "🟢11 speed dribbles and finds a cross to 🟢7.🔴7 has to run behind the back of🟢11 to start defending.Ball 2 by🔴11 needs to find a cross after dribbling past a cone or do a S&G upon scoring.",
      success: "The first ball is crossed 90% correctly, and the second ball approximately 50%"
    },
    drill3: {
      title: "S&G in squares",
      desc: "S&G with 100% acceleration in sets of 10 [50 sec]. Increase intensity > Increase duration during the week.+ Combine S&G with change of direction and/or first touch after passing.",
      success: "[60 Sec] S&G with 100% acceleration without colliding"
    },
    video: "https://www.capcut.cn/share/7647067494599120190"
  },
  "A8 | U8": {
    age: "U8",
    topic: "A8",
    coach: "",
    activation: {
      title: "Cross and defend",
      desc: "Finish after a quick dribble over the wing and become the defender on the other side immediately.- Change to the left foot as well.",
      success: "Score most of the crosses, at least shoot on target"
    },
    drill1: {
      title: "Finish and defend",
      desc: "🟢7 speed dribbles, crosses to 🟢11 and becomes the defender.🟢11 finishes and takes the wing position next.",
      success: "Due to improved reaction, scoring goals is getting harder."
    },
    drill2: {
      title: "3v2 - 4v3 Transition",
      desc: "🟢11 speed dribbles and finds a cross to 🟢7.🔴7 has to run behind the back of🟢11 to start defending.Ball 2🔴11 needs to find a cross after dribbling past a cone or do a S&G upon scoring.",
      success: "Stronges crosses followed up by accurrate finishes is applauded by visitors"
    },
    drill3: {
      title: "2v2 + Wing crosses",
      desc: "Either S&G with crosses, or a continuous 2v2 transition where the wingers need to find the best possible cross.",
      success: "The energy shown is contagous."
    },
  },
  "A8 | U9": {
    age: "U9",
    topic: "A8",
    coach: "",
    activation: {
      title: "Crossing and finishing",
      desc: "🟢9 passes to 🟢7 who dribbles to endline and crosses. 🟢9 runs around blue cone, gets into box for finishing within 2 touches [excl. rebound]. Then touch the goal and transit to defending.",
      success: "Speed up the play as team, together put efforts into it"
    },
  },
  "A8 | U11": {
    age: "U11",
    topic: "A8",
    coach: "",
    activation: {
      title: "Technical crossing and finishing practice",
      desc: "Players cross and finish from both wings in unopposed setting. Rotation: Shooter > GK, GK > Cross, Cross > Shooter. Emphasis on technical skills of crossing and shooting, angles of crosses and approach to the ball to shoot.",
      success: "Play deliberate and accurate crossings"
    },
    drill1: {
      title: "1v1 crossing practice",
      desc: "Coach plays ball to winger. Winger tries to beat the opponent and cross the ball. Emphasis is on confidently beating opponent to create crossing chance, hitting target goals with cross. Mini goals can be moved further for higher and harder crosses.",
      success: "Winger is confident in 1v1, has the idea where and how to beat the opponent. Crosses hit the target goals most of the time."
    },
    drill2: {
      title: "2v2+2 wave game",
      desc: "Players play continous 2v2 game with 2 neutral players. The game starts with a pass to one of the neutral players. First attack, then defend, then rotate. The game finishes with a shot on target(or one touch reboud shot if possible). Neutrals can be allowed/restricted to score by themselves if not pressed when with the ball.",
      success: "When all players make well timed runs into spaces most of the time. When most of the plays end up with shots on target. When shots are accurate and well aimed at the target most of the time."
    },
    drill3: {
      title: "1v1 crossing game",
      desc: "Game starts with G4 dribbling ang crossing into mini gate. Then G4 has to sprint to block the cross from R7. Game continues in waves. First team to cross X goals into mini goals wins. - Increase/decrease distances for difficulty",
      success: "Players can accelerate and cross into small goals most of the time."
    },
  },
};