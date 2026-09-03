const requireEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Set it in your environment before running this script.`);
  }
  return value;
};

export default requireEnv;
