import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist/ui/ascii", { recursive: true });
copyFileSync("src/ui/ascii/cat.txt", "dist/ui/ascii/cat.txt");
