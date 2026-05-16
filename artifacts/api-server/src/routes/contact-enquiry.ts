import { Router } from "express";
import { sendContactEnquiryEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

router.post("/contact-enquiry", async (req, res) => {
  const { firstName, lastName, email, phone, serviceName, message } = req.body ?? {};

  if (
    typeof firstName !== "string" || firstName.trim().length < 1 ||
    typeof lastName !== "string" || lastName.trim().length < 1 ||
    typeof email !== "string" || !email.includes("@") ||
    typeof phone !== "string" || phone.trim().length < 1 ||
    typeof serviceName !== "string" || serviceName.trim().length < 1
  ) {
    res.status(400).json({ error: "Missing or invalid fields" });
    return;
  }

  try {
    await sendContactEnquiryEmail({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      serviceName: serviceName.trim(),
      message: typeof message === "string" ? message.trim() : undefined,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Failed to send contact enquiry email");
    res.status(500).json({ error: "Failed to send enquiry" });
  }
});

export default router;
