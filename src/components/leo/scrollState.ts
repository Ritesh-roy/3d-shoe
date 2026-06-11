// Shared scroll state read by the R3F scene. The HTML side writes progress
// values from GSAP ScrollTrigger; the canvas reads them on each frame.

export const scrollState = {
  progress: 0, // 0..1 across the whole page
  section: 0, // 0..7
  explode: 0,
  colorway: "white" as "white" | "grey" | "red" | "volt",
  mouseX: 0,
  mouseY: 0,
};
