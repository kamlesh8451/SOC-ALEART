import bcrypt from 'bcrypt';

async function test() {
  const pass = 'admin123';
  const hash = '$2b$10$okqTNgmorxoBONhfPM/Q1uMqBz.BAELpwzqw.sYF1U8v5yK.M8.VG';
  const match = await bcrypt.compare(pass, hash);
  console.log(`Password: ${pass}`);
  console.log(`Hash: ${hash}`);
  console.log(`Match: ${match}`);
}

test();
