import jwt from "jsonwebtoken";

export function signToken(userId, secret) {
  return jwt.sign({ sub: userId }, secret, { expiresIn: "7d" });
}

export function authMiddleware({ jwtSecret }) {
  return (req, res, next) => {
    const header = req.header("authorization") || "";
    const [type, token] = header.split(" ");
    if (type !== "Bearer" || !token) return res.status(401).json({ error: "Unauthorized" });

    try {
      const payload = jwt.verify(token, jwtSecret);
      req.userId = payload.sub;
      next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}

