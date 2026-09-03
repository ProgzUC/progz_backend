import dotenv from "dotenv";

dotenv.config();

export const getTestPassword = (role) => {
  const map = {
    admin: process.env.TEST_ADMIN_PASSWORD,
    trainer: process.env.TEST_TRAINER_PASSWORD,
    student: process.env.TEST_STUDENT_PASSWORD,
  };

  const password = map[role];
  if (!password) {
    throw new Error(
      `TEST_${role.toUpperCase()}_PASSWORD is required for verification scripts.`
    );
  }

  return password;
};
