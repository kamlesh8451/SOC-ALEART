import bcrypt from 'bcrypt';

async function generate() {
  const pass = 'admin123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(pass, salt);
  console.log(`Password: ${pass}`);
  console.log(`Hash: ${hash}`);
}

generate();
