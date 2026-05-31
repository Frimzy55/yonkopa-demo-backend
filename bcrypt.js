import bcrypt from "bcrypt";

const password = "";

const hashedPassword = await bcrypt.hash(password, 10);

console.log(hashedPassword);