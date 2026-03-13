 
function convertQuickDraw(input) {

  if (!input) return [];

  const drawing = Array.isArray(input) ? input : input.drawing;

  if (!Array.isArray(drawing)) {
    console.warn("Invalid QuickDraw format");
    return [];
  }

  const strokes = [];

  for (const stroke of drawing) {

    const xs = stroke[0];
    const ys = stroke[1];

    if (!xs || !ys) continue;

    for (let i = 1; i < xs.length; i++) {

      strokes.push({
        x: xs[i] / 255,
        y: ys[i] / 255,
        prevX: xs[i - 1] / 255,
        prevY: ys[i - 1] / 255,
        tool: "draw",
        color: "#000"
      });

    }

  }

  return strokes;
}

module.exports = convertQuickDraw;
