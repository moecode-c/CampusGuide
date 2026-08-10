import bcrypt from "bcrypt";
import { AccountStatuses, User } from "../src/server/models/User";
import { Roles } from "../src/server/roles";

type SeedAdmin = {
  email: string;
  name: string;
  password: string;
  academicYear: number;
};

// Built lazily so SEED_ADMIN_PASSWORD is read after .env.local is loaded.
function defaultAdmins(): SeedAdmin[] {
  // Development defaults. Override with SEED_ADMIN_PASSWORD before running this
  // against anything that is not a local database.
  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";

  return [
    { email: "admin@campusguide.local", name: "Admin", password, academicYear: 1 },
    { email: "superadmin@campusguide.local", name: "Super Admin", password, academicYear: 1 },
  ];
}

export async function seedAdmins() {
  const admins = defaultAdmins();

  for (const admin of admins) {
    const email = admin.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(admin.password, 12);

    await User.updateOne(
      { email },
      {
        $set: {
          email,
          name: admin.name,
          passwordHash,
          role: Roles.Admin,
          academicYear: admin.academicYear,
          // Seeded admins skip the ID-photo verification flow entirely.
          status: AccountStatuses.Active,
          verifiedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    console.log(`  ${email} / ${admin.password}`);
  }

  return admins.length;
}
