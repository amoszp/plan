// The three home sessions. img = photo pair in img/ex/<img>-0.jpg (start) and -1.jpg (end).
// work = seconds per set, side = seconds per side, kg = starting weight, perHand = weight per dumbbell.
const EX = {
  warm:{name:"Warm-up", img:"Arm_Circles", kind:"warm", list:[["Arm circles","Arm_Circles"],["Wrist circles","Wrist_Circles"],["Band pull-aparts","Band_Pull_Apart"],["Bodyweight squats","Bodyweight_Squat"],["Band good mornings","Band_Good_Morning"],["Slow push-ups","Pushups"]], tip:"30 s each, no rest. The clock moves you on."},
  split:{name:"Bulgarian split squat", img:"Split_Squat_with_Dumbbells", side:40, reps:"8–12 per leg", kg:10, perHand:true, tip:"Back foot on the sofa. Dumbbell in each hand."},
  pu:{name:"Push-ups on the handles", img:"Pushups", work:45, reps:"10–20 (aim 18–20)", kg:null, tip:"At 20, put your feet on the sofa."},
  rdl:{name:"Romanian deadlift", img:"Stiff-Legged_Dumbbell_Deadlift", work:45, reps:"12–15", kg:10, perHand:true, tip:"Hips back, back flat, 1 s at the bottom stretch."},
  row1:{name:"One-arm row", img:"One-Arm_Dumbbell_Row", side:40, reps:"10–15 per arm", kg:10, tip:"Hand and knee on the sofa. Load one dumbbell heavier if the plates fit."},
  lat:{name:"Lateral raise", img:"Side_Lateral_Raise", work:40, reps:"15–20", kg:8, perHand:true, tip:"No swinging. If the body moves to lift it, go lighter (5–6 kg)."},
  plank:{name:"Plank", img:"Plank", work:40, reps:"hold 40 s", log:"40seg", kg:null, tip:"Body straight, squeeze glutes."},
  gob:{name:"Goblet squat", img:"Goblet_Squat", work:45, reps:"12–15", kg:10, tip:"One dumbbell upright against your chest. Load it as heavy as the plates allow. 2 s pause at the bottom."},
  bor:{name:"Bent-over row", img:"Bent_Over_Two-Dumbbell_Row_With_Palms_In", work:45, reps:"12–15", kg:10, perHand:true, tip:"Palms facing in, 1 s squeeze at the top."},
  hip:{name:"Single-leg hip thrust", img:"Single_Leg_Glute_Bridge", side:40, reps:"12–15 per leg", kg:null, tip:"Shoulders on the sofa. Dumbbell on the hip once it gets easy."},
  press:{name:"Seated shoulder press", img:"Seated_Dumbbell_Press", work:45, reps:"10–15", kg:8, perHand:true, tip:"Full range, no arching the back."},
  curl:{name:"Dumbbell curl", img:"Dumbbell_Bicep_Curl", work:40, reps:"10–12", kg:10, perHand:true, tip:"Slow down, no swinging."},
  tri:{name:"Band triceps extension", img:"Speed_Band_Overhead_Triceps", work:40, reps:"15–20", kg:null, tip:"Band under your foot, arms overhead."},
  circ:{name:"16-minute circuit", img:"Pushups", kind:"amrap", time:960, list:[["8 push-ups","Pushups"],["10 bent-over rows","Bent_Over_Two-Dumbbell_Row_With_Palms_In"],["10 goblet squats","Goblet_Squat"],["10 Romanian deadlifts","Stiff-Legged_Dumbbell_Deadlift"],["10 dead bugs","Dead_Bug"]], tip:"Round and round without stopping. Rest only when you need to. Tap +1 after each round."}
};

const SESS = {
  A:[["warm"],["split"],["pu"],["rdl"],["row1"],["lat",2],["plank",2]],
  B:[["warm"],["gob"],["bor"],["hip"],["press"],["curl",2],["tri",2]],
  C:[["warm"],["circ"]]
};
