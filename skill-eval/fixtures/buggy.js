// 故意留 bug：off-by-one，漏掉最后一个元素
function sum(arr) {
  let total = 0;
  for (let i = 0; i < arr.length - 1; i++) {
    total += arr[i];
  }
  return total;
}

module.exports = { sum };
