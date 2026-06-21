import { db } from "./index";
import { categories } from "./schema";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

async function main() {
  console.log("Seeding categories...");
  await db.insert(categories).values([
    { id: "sports", name: "Sports", emoji: "🏸" },
    { id: "movies", name: "Movies", emoji: "🎬" },
    { id: "food", name: "Food", emoji: "🍔" },
    { id: "fitness", name: "Fitness", emoji: "🏃" },
    { id: "gaming", name: "Gaming", emoji: "🎮" },
    { id: "music", name: "Music", emoji: "🎸" },
  ]).onConflictDoNothing();
  
  console.log("Categories seeded successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding:", err);
  process.exit(1);
});
