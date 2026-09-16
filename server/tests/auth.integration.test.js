const { request, app, prisma, resetDb, signup } = require("./helpers");

afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

describe("Authentication", () => {
  test("signup creates a USER-role account and returns a token", async () => {
    const { status, body } = await signup({ email: "alice@test.com" });
    expect(status).toBe(201);
    expect(body.user.role).toBe("USER");
    expect(body.token).toBeTruthy();
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  test("password is hashed at rest, never stored in plaintext", async () => {
    const { user } = await signup({ email: "bob@test.com", password: "SuperSecret1" });
    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row.passwordHash).not.toBe("SuperSecret1");
    expect(row.passwordHash.length).toBeGreaterThan(20);
  });

  test("signup rejects mismatched passwords", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "X", email: "mismatch@test.com", password: "Password123", confirmPassword: "Different123" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("signup rejects duplicate email", async () => {
    await signup({ email: "dupe@test.com" });
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "X", email: "dupe@test.com", password: "Password123", confirmPassword: "Password123" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  test("signup ignores any client-supplied role and always creates USER", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "X", email: "hacker@test.com", password: "Password123", confirmPassword: "Password123", role: "ADMIN" });
    expect(res.body.user.role).toBe("USER");
  });

  test("login with correct credentials succeeds", async () => {
    const { email, password } = await signup({ email: "carol@test.com", password: "Password123" });
    const res = await request(app).post("/api/v1/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test("login with wrong password fails with 401", async () => {
    const { email } = await signup({ email: "dave@test.com", password: "Password123" });
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: "WrongPassword" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("GET /me requires authentication", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  test("GET /me returns the authenticated user", async () => {
    const { token, user } = await signup({ email: "erin@test.com" });
    const res = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });
});
