/**
 * Distribuția clipurilor: foi de personaj (același om din mai multe unghiuri) din public/cast.
 * Prezentatorul se alege la întâmplare dintre oamenii de genul potrivit afacerii; alți doi
 * din aceeași listă apar ca clienți în scene, ca să nu inventeze modelul fețe noi la fiecare cadru.
 */
export type CastGender = "female" | "male";
export type ExtrasMode = CastGender | "mixed";
export type CastMember = { id: string; gender: CastGender; age: "young" | "adult" | "mature" };
export type CastPick = { presenter: string; extras: string[] };

export const CAST: CastMember[] = [
  { id: "m01", gender: "male", age: "adult" },
  { id: "m02", gender: "male", age: "mature" },
  { id: "m03", gender: "male", age: "adult" },
  { id: "m04", gender: "male", age: "mature" },
  { id: "m05", gender: "male", age: "adult" },
  { id: "m06", gender: "male", age: "young" },
  { id: "m07", gender: "male", age: "adult" },
  { id: "m08", gender: "male", age: "adult" },
  { id: "m09", gender: "male", age: "mature" },
  { id: "m10", gender: "male", age: "young" },
  { id: "f01", gender: "female", age: "adult" },
  { id: "f02", gender: "female", age: "mature" },
  { id: "f03", gender: "female", age: "adult" },
  { id: "f04", gender: "female", age: "mature" },
  { id: "f05", gender: "female", age: "young" },
  { id: "f06", gender: "female", age: "adult" },
  { id: "f07", gender: "female", age: "adult" },
  { id: "f08", gender: "female", age: "adult" },
];

export function castUrl(id: string, site = "https://www.adpilot.ro"): string {
  return `${site}/cast/${id}.jpg`;
}

function takeRandom<T>(pool: T[], rand: () => number): T {
  const i = Math.floor(rand() * pool.length);
  return pool.splice(Math.min(i, pool.length - 1), 1)[0];
}

/**
 * Prezentatorul (genul cerut) și 2 figuranți: de același gen pentru afacerile „de femei” sau
 * „de bărbați”, câte unul din fiecare pentru celelalte. Fără să repete oameni; `avoid` = cine
 * a fost prezentator data trecută la același client (dacă se poate, altcineva).
 */
export function pickCast(presenter: CastGender, extras: ExtrasMode, rand: () => number = Math.random, avoid?: string): CastPick {
  const pool = CAST.filter((c) => c.gender === presenter);
  const fresh = pool.filter((c) => c.id !== avoid);
  const lead = takeRandom(fresh.length ? fresh : pool, rand);
  const rest = CAST.filter((c) => c.id !== lead.id);
  const of = (g: CastGender) => rest.filter((c) => c.gender === g);
  const picked: CastMember[] = [];
  if (extras === "mixed") {
    for (const g of ["female", "male"] as const) {
      const p = of(g).filter((c) => !picked.includes(c));
      if (p.length) picked.push(takeRandom(p, rand));
    }
    if (rand() < 0.5) picked.reverse();
  } else {
    const p = of(extras);
    while (picked.length < 2 && p.length) picked.push(takeRandom(p, rand));
  }
  return { presenter: lead.id, extras: picked.map((c) => c.id) };
}
