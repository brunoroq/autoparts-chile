// Ilustraciones vectoriales originales del proyecto, sin recursos de terceros.
import fs from "node:fs/promises";
import sharp from "sharp";

const rect = (x, y, w, h, fill = "url(#metal)", r = 12) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
const circle = (x, y, r, fill = "url(#metal)") =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const path = (d, stroke = "#343a40", width = 20) =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
const label = (text, x = 400, y = 425, size = 26, color = "#fafafa") =>
  `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" font-weight="700" text-anchor="middle" fill="${color}">${text}</text>`;
const bulb = (x = 300, y = 210) =>
  `${rect(x, y, 85, 210)}${rect(x - 18, y + 105, 121, 68, "#262a30")}${rect(x + 10, y + 22, 22, 65, "#ffe198", 3)}${rect(x + 50, y + 22, 22, 65, "#ffe198", 3)}${rect(x + 8, y + 211, 68, 90, "#3a3f46")}${rect(x + 15, y + 300, 18, 28, "#a3a7ac", 3)}${rect(x + 52, y + 300, 18, 28, "#a3a7ac", 3)}`;
const bottle = (color, title) =>
  `${rect(310, 230, 180, 350, color, 32)}${rect(348, 165, 105, 85, "#20242a")}${rect(325, 350, 150, 130, "#f8f8f8", 4)}${label("AUTO", 400, 390, 29, "#25282d")}${label(title, 400, 435, 19, "#b91c1c")}`;
const shapes = [
  bulb(240, 210) + bulb(455, 260),
  `${circle(400, 290, 75, "#d9e3e8")}${rect(352, 340, 96, 130)}${rect(335, 463, 130, 42, "#333941")}${path("M370 505v58 M430 505v58", "#b5b9bd", 16)}${path("M385 265l15 70 15-70", "#dbab54", 6)}`,
  `${rect(210, 310, 380, 170, "#31363d", 35)}${rect(235, 335, 330, 120, "#e7edf0", 20)}${Array.from({ length: 8 }, (_, i) => rect(255 + i * 37, 365, 22, 47, "#ffe8a1", 3)).join("")}`,
  `${rect(355, 260, 90, 300, "#20262d", 25)}${rect(337, 200, 126, 90, "#b91c1c", 20)}${rect(350, 215, 100, 50, "#fff2cd", 10)}${circle(400, 390, 17, "#bd1b24")}${path("M380 200v-45q20-30 40 0v45", "#52575f", 14)}`,
  `${rect(235, 330, 330, 100, "#343a40", 20)}${rect(250, 343, 300, 73, "#fff0bf", 10)}${path("M565 375h55q35 0 35 40v95", "#222", 10)}`,
  `${rect(330, 250, 140, 260, "url(#dark)", 28)}${rect(300, 220, 200, 85, "#2c323b", 32)}${rect(330, 245, 55, 30, "#171b22", 7)}${rect(410, 245, 48, 24, "#c71f2b", 7)}${label("USB-C", 400, 400, 22)}${circle(400, 490, 18, "#b9bdc2")}`,
  `${rect(320, 290, 160, 235, "url(#dark)", 30)}${rect(280, 220, 240, 125, "#262d35", 28)}${rect(310, 242, 180, 70, "#11161a", 10)}${label("87.5", 400, 289, 40, "#fd4854")}${circle(400, 390, 42, "#6b7077")}${circle(400, 390, 25, "#20242a")}`,
  `${path("M400 500v-210 M300 310h200 M315 310v110 M485 310v110", "#313741", 32)}${rect(325, 245, 150, 260, "#303741", 20)}${rect(345, 270, 110, 200, "#161c23", 12)}${rect(270, 325, 60, 120, "#d02330", 12)}${rect(470, 325, 60, 120, "#d02330", 12)}${rect(330, 540, 140, 30)}`,
  `${rect(250, 285, 300, 220, "#242b33", 32)}${circle(400, 395, 82, "#767f8c")}${circle(400, 395, 65, "#151c27")}${circle(400, 395, 38, "#274766")}${circle(385, 380, 12, "#9bb9d0")}${path("M260 305l-35-65h350l-30 65", "#333b44", 20)}`,
  `${rect(270, 260, 260, 280, "#313943", 25)}${rect(300, 300, 200, 110, "#101820", 12)}${label("12.8", 400, 380, 60, "#fd3c48")}${label("VOLT", 400, 465, 24)}${rect(350, 540, 100, 45)}`,
  bottle("#be202f", "SHAMPOO"),
  `${rect(220, 370, 330, 170, "#9aa9af", 18)}${rect(255, 310, 330, 170, "#b4c1c7", 18)}${rect(290, 250, 300, 170, "#d82635", 18)}${path("M310 280h255 M310 305h255 M310 330h255", "#ee6b75", 3)}`,
  `${bottle("#303943", "LLANTAS")}${rect(340, 145, 160, 55, "#b91c1c", 10)}${path("M460 200l-25 65", "#20262d", 18)}`,
  `${path("M400 450v140", "#b91c1c", 45)}${rect(355, 220, 90, 260, "#272e36", 28)}${Array.from({ length: 12 }, (_, i) => path(`M340 ${240 + i * 18}h120`, "#525d67", 10)).join("")}`,
  bottle("#b91c1c", "CERA"),
  `${rect(175, 230, 450, 340, "#292f36", 28)}${rect(195, 250, 410, 300, "#424a54", 18)}${Array.from({ length: 12 }, (_, i) => `${circle(245 + (i % 6) * 63, 310 + Math.floor(i / 6) * 110, 23)}${circle(245 + (i % 6) * 63, 310 + Math.floor(i / 6) * 110, 10, "#222a32")}`).join("")}${path("M240 495h320", "#acb3bc", 17)}`,
  `${path("M240 240l320 320 M560 240L240 560", "#a3acb6", 38)}${circle(400, 400, 38)}${circle(400, 400, 14, "#333")}`,
  `${path("M400 430v130", "#333b44", 44)}${circle(400, 325, 120, "#343b45")}${circle(400, 325, 95, "#fafafa")}${Array.from(
    { length: 9 },
    (_, i) => {
      const a = ((i * 30 + 150) * Math.PI) / 180;
      return path(
        `M${400 + 72 * Math.cos(a)} ${325 + 72 * Math.sin(a)}L${400 + 86 * Math.cos(a)} ${325 + 86 * Math.sin(a)}`,
        "#343b45",
        5,
      );
    },
  ).join(
    "",
  )}${path("M400 325l50-45", "#b91c1c", 9)}${circle(400, 325, 12, "#b91c1c")}`,
  `${rect(230, 330, 340, 210, "#343c45", 30)}${rect(270, 370, 180, 95, "#bd2532", 12)}${path("M300 330v-70h200v70", "#343c45", 25)}${circle(510, 400, 38, "#dce0e5")}${circle(510, 400, 25, "#fff")}${path("M565 480q120-200 90-235q-45-80-60 15", "#282d34", 14)}`,
  `${[0, 1, 2, 3].map((i) => `${path(`M${280 + i * 80} 200v280`, "#aeb6bf", 12)}${rect(260 + i * 80, 400, 40, 170, i % 2 ? "#252c35" : "#bc2531", 18)}`).join("")}`,
  `<path d="M400 200L605 555H195Z" fill="#b91c1c"/><path d="M400 275L540 520H260Z" fill="#fafafa"/><path d="M400 345L475 480H325Z" fill="#d72936"/>${path("M230 580h340", "#333", 16)}`,
  `<path d="M285 240l65-30 50 85 50-85 65 30 80 300H205Z" fill="#d5e63a"/><path d="M350 210l50 85 50-85-18 330h-64Z" fill="#f4f4ee"/>${rect(230, 425, 340, 32, "#b5bcc4", 0)}${path("M400 300v235", "#333b44", 6)}`,
  `${path("M400 320v260", "#252d36", 45)}${rect(300, 230, 210, 95, "#b91c1c", 18)}<path d="M510 235l85 45-85 40Z" fill="#b4bac1"/>${rect(378, 480, 44, 110, "#bd2531", 14)}`,
  `${path("M250 300q-110 280 130 260q230 0 110-230", "#b91c1c", 18)}${path("M500 300q100 280-110 240q-210 0-120-210", "#262d35", 18)}${rect(190, 225, 80, 140, "#b91c1c", 12)}${rect(490, 230, 80, 140, "#252d35", 12)}${rect(208, 205, 44, 45)}${rect(508, 210, 44, 45)}`,
  `${rect(230, 280, 340, 260, "#b91c1c", 28)}${path("M330 280v-55h140v55", "#4c535b", 22)}${rect(375, 335, 50, 150, "#fff", 3)}${rect(325, 385, 150, 50, "#fff", 3)}`,
  `${rect(250, 210, 300, 380, "#313942", 30)}${rect(280, 330, 240, 150, "#151b23", 10)}${path("M400 340v130 M270 275h260", "#69727e", 8)}${path("M320 210v-45h160v45", "#333b44", 18)}`,
  `${rect(270, 240, 260, 350, "#333b44", 40)}${rect(220, 200, 260, 350, "#222a32", 40)}${Array.from({ length: 8 }, (_, i) => path(`M250 ${250 + i * 35}h200`, "#4a535e", 8)).join("")}`,
  `${rect(185, 250, 430, 280, "#b6bec8", 35)}${path("M400 255v270 M215 280l180 240 M580 280L405 520", "#788390", 5)}${rect(370, 370, 60, 35, "#bd2731", 6)}`,
  `${circle(400, 400, 190, "#242c35")}${circle(400, 400, 135, "#f3f4f6")}${path("M235 310q165-170 330 0", "#b91c1c", 28)}${path("M235 500q165 155 330 0", "#414a55", 18)}`,
  `${rect(200, 300, 400, 260, "#303943", 25)}${rect(225, 330, 350, 100, "#151c25", 12)}${path("M400 330v220 M270 300v-65h260v65", "#737e8a", 14)}${rect(340, 455, 120, 55, "#b91c1c", 8)}`,
];

const template = (shape) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><defs><linearGradient id="metal" x2="1" y2="1"><stop stop-color="#e1e5e9"/><stop offset=".45" stop-color="#8c98a6"/><stop offset=".7" stop-color="#dce1e5"/><stop offset="1" stop-color="#626f7e"/></linearGradient><linearGradient id="dark" x2="1" y2="1"><stop stop-color="#535e6d"/><stop offset="1" stop-color="#171e27"/></linearGradient><filter id="shadow" x="-50%" y="-30%" width="200%" height="200%"><feDropShadow dx="0" dy="20" stdDeviation="16" flood-opacity=".15"/></filter></defs><rect width="800" height="800" fill="#f3f4f6"/><ellipse cx="400" cy="620" rx="210" ry="22" fill="#dce0e5" opacity=".6"/><g filter="url(#shadow)">${shape}</g></svg>`;
await fs.mkdir("public/images/products", { recursive: true });
await fs.mkdir("public/images/sources", { recursive: true });
for (const [i, shape] of shapes.entries()) {
  const name = `product-${String(i + 1).padStart(2, "0")}`;
  const svg = template(shape);
  await fs.writeFile(`public/images/sources/${name}.svg`, svg);
  await sharp(Buffer.from(svg))
    .webp({ quality: 82 })
    .toFile(`public/images/products/${name}.webp`);
}
await sharp(
  Buffer.from(
    template(
      `${circle(400, 390, 115, "#c9ced5")}${label("AP", 400, 415, 70, "#4b5563")}`,
    ),
  ),
)
  .webp({ quality: 80 })
  .toFile("public/images/products/fallback.webp");
console.log(
  "30 ilustraciones originales WebP (800x800), fuentes SVG y fallback creados.",
);
