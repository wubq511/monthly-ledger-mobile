export function formatCurrency(amount: number) {
  return `¥${amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCompactCurrency(amount: number) {
  if (amount >= 10000) {
    return `¥${(amount / 10000).toFixed(1)}万`;
  }

  if (amount >= 1000) {
    return `¥${(amount / 1000).toFixed(1)}k`;
  }

  return formatCurrency(amount);
}
