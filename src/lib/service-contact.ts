export function normalizeContactPhone(value: string): string | null {
  if (/[^\d\s()+.\-]/u.test(value)) return null;
  let digits = value.replace(/\D/g, '');
  if (value.includes('+') && (!/^\s*\+55[\d\s().\-]+$/.test(value) || ![12, 13].includes(digits.length))) return null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  return /^[1-9]{2}\d{8,9}$/.test(digits) && !/^(\d)\1+$/.test(digits) ? digits : null;
}
export const formatContactPhone = (digits: string) => `(${digits.slice(0, 2)}) ${digits.slice(2, -4)}-${digits.slice(-4)}`;
export function serviceContactUrl(data: {name: string; phone: string; interest: string; unit: string; recipient: string; page: string}) {
  const phone = normalizeContactPhone(data.phone);
  if (!data.name.trim() || !phone || !data.interest || !data.unit || !/^55\d{10,11}$/.test(data.recipient)) throw new Error('Confira os dados antes de continuar.');
  const message = [
    'Olá! Gostaria de conversar com a equipe do Instituto Bicalho.',
    `Nome: ${data.name.trim().replace(/\s+/g, ' ')}`,
    `WhatsApp: +55 ${formatContactPhone(phone)}`,
    `Serviço de interesse: ${data.interest}`,
    `Unidade: ${data.unit}`,
    `Página de origem: ${data.page}`,
  ].join('\n');
  return `https://wa.me/${data.recipient}?text=${encodeURIComponent(message)}`;
}
