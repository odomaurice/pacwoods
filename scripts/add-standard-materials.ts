/** Adds the standard sheet materials to the catalogue (skips ones already there). */
import mongoose from "mongoose";
import { addStandardMaterials } from "../src/server/services/materials";

addStandardMaterials()
  .then((added) => console.log(`${added} standard materials added.`))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
