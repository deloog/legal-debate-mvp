/**
 * 生成有效的中国身份证号
 */

function generateValidIdCard(
  regionCode: string,
  birthDate: Date,
  sequence: number,
): string {
  // 前17位
  const prefix = `${regionCode}${birthDate.getFullYear()}${String(birthDate.getMonth() + 1).padStart(2, "0")}${String(birthDate.getDate()).padStart(2, "0")}${String(sequence).padStart(3, "0")}`;

  // 计算校验码
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += parseInt(prefix[i], 10) * weights[i];
  }

  const checkCode = checkCodes[sum % 11];

  return prefix + checkCode;
}

function validateIdCard(idCard: string): boolean {
  if (idCard.length !== 18) {
    return false;
  }

  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const checkCodes = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += parseInt(idCard[i], 10) * weights[i];
  }

  const expectedCheckCode = checkCodes[sum % 11];
  const actualCheckCode = idCard[17].toUpperCase();

  return expectedCheckCode === actualCheckCode;
}

// 生成一些有效的身份证号
console.log("生成有效的身份证号:");
const id1 = generateValidIdCard("110101", new Date(1990, 0, 1), 123);
console.log(`11010119900101123 -> ${id1} (验证: ${validateIdCard(id1)})`);

const id2 = generateValidIdCard("110101", new Date(1990, 0, 1), 124);
console.log(`11010119900101124 -> ${id2} (验证: ${validateIdCard(id2)})`);

const id3 = generateValidIdCard("110101", new Date(1990, 0, 1), 125);
console.log(`11010119900101125 -> ${id3} (验证: ${validateIdCard(id3)})`);

// 验证原来的身份证号
console.log("\n验证原来的身份证号:");
console.log(`110101199001011231 验证: ${validateIdCard("110101199001011231")}`);
console.log(`110101199001011234 验证: ${validateIdCard("110101199001011234")}`);
