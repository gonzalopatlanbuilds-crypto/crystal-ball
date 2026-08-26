// Validación real de CLABE (Clave Bancaria Estandarizada, México).
// Esto NO es un dato simulado: el dígito verificador se calcula con el
// algoritmo estándar de Banxico (pesos cíclicos 3-7-1 sobre los primeros
// 17 dígitos, módulo 10). Una CLABE con dígito verificador válido solo
// confirma que el número está bien formado — no confirma que la cuenta
// sea segura ni que pertenezca a quien dice ser.

// Catálogo simplificado de bancos por los primeros 3 dígitos de la CLABE.
// No es exhaustivo: solo cubre instituciones comunes para esta demo.
const CATALOGO_BANCOS: Record<string, string> = {
  "002": "Banamex",
  "012": "BBVA México",
  "014": "Santander",
  "021": "HSBC",
  "036": "Inbursa",
  "044": "Scotiabank",
  "058": "Banregio",
  "072": "Banorte",
  "127": "Banco Azteca",
  "137": "Bancoppel",
  "646": "STP (transferencias interbancarias)",
};

export interface ResultadoClabe {
  formatoValido: boolean;
  digitoVerificadorValido: boolean;
  banco: string | null;
  codigoBanco: string | null;
}

const PESOS = [3, 7, 1];

function calcularDigitoVerificador(primeros17: string): number {
  let suma = 0;
  for (let i = 0; i < 17; i++) {
    const digito = Number(primeros17[i]);
    const peso = PESOS[i % 3];
    suma += (digito * peso) % 10;
  }
  return (10 - (suma % 10)) % 10;
}

export function validarClabe(clabeCruda: string): ResultadoClabe {
  const clabe = clabeCruda.trim();
  const formatoValido = /^\d{18}$/.test(clabe);

  if (!formatoValido) {
    return {
      formatoValido: false,
      digitoVerificadorValido: false,
      banco: null,
      codigoBanco: null,
    };
  }

  const codigoBanco = clabe.slice(0, 3);
  const digitoEsperado = calcularDigitoVerificador(clabe.slice(0, 17));
  const digitoVerificadorValido = digitoEsperado === Number(clabe[17]);

  return {
    formatoValido: true,
    digitoVerificadorValido,
    banco: CATALOGO_BANCOS[codigoBanco] ?? null,
    codigoBanco,
  };
}
