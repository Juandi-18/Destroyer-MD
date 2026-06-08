import db from '#db';

export const MAX_BALANCE = 999999999999999;

export function getTotalBalance(user) {
  return (user?.coins || 0) + (user?.bank || 0);
}

export function isInDebt(user) {
  return (user?.bank || 0) < 0;
}

export function debtBlock(user) {
  if (isInDebt(user)) {
    return `❌ No puedes realizar esta acción mientras tengas deudas pendientes en el banco (*¥${formatCoins(Math.abs(user.bank))}*). ¡Primero salda tus cuentas!`;
  }
  return null;
}

export function checkBalanceLimit(user, amount) {
  if (!amount || amount <= 0) return null;
  const currentTotal = getTotalBalance(user);
  if (currentTotal + amount > MAX_BALANCE) {
    return `❌ No puedes recibir esta ganancia porque tu balance total excedería el límite máximo de *¥${formatCoins(MAX_BALANCE)}*. Reduce tu saldo o paga tu deuda primero.`;
  }
  return null;
}

export function applyDebtPayment(chatId, senderId, amount, user) {
  const error = checkBalanceLimit(user, amount);
  if (error) {
    return { error };
  }
  if (isInDebt(user)) {
    const deuda = Math.abs(user.bank || 0);
    if (amount >= deuda) {
      const sobrante = amount - deuda;
      db.setChatUser(chatId, senderId, 'bank', 0);
      if (sobrante > 0) {
        db.setChatUser(chatId, senderId, 'coins', (user.coins || 0) + sobrante);
      }
    } else {
      db.setChatUser(chatId, senderId, 'bank', (user.bank || 0) + amount);
    }
  } else {
    db.setChatUser(chatId, senderId, 'coins', (user.coins || 0) + amount);
  }
  return { error: null };
}

/**
 * Convierte un número en un string formateado con separadores de miles (comas)
 * @param {number} value - El monto numérico a formatear
 * @returns {string} - El string formateado (ej. "1,250,000")
 */
export function formatCoins(value) {
  if (value === undefined || value === null) return '0';
  const numericValue = parseInt(value);
  return isNaN(numericValue) ? '0' : numericValue.toLocaleString('en-US');
}
