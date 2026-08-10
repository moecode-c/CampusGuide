import { connect, disconnect } from "./db";
import { seedAdmins } from "./admins";
import { backfillAccountStatus } from "./backfill";

type Seeder = {
  name: string;
  run: () => Promise<number>;
};

const seeders: Seeder[] = [
  { name: "admins", run: seedAdmins },
  { name: "backfill", run: backfillAccountStatus },
];

async function main() {
  await connect();

  try {
    // A name can be passed to run a single seeder, e.g. `npm run seed admins`.
    const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
    const selected = only.length ? seeders.filter((s) => only.includes(s.name)) : seeders;

    const unknown = only.filter((n) => !seeders.some((s) => s.name === n));
    if (unknown.length) {
      throw new Error(
        `Unknown seeder(s): ${unknown.join(", ")}. Available: ${seeders.map((s) => s.name).join(", ")}`
      );
    }

    for (const seeder of selected) {
      console.log(`Seeding ${seeder.name}...`);
      const count = await seeder.run();
      console.log(`Seeded ${count} ${seeder.name} record(s).`);
    }
  } finally {
    await disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
