// Gera o SQL da tabela app_private.lancamentos a partir de RELEASES (src/data.ts): é dela que o banco tira
// os avisos de estreia do dia e a data de Doutor Destino para a contagem.
// Rodar de novo (e aplicar a saída no Supabase) sempre que RELEASES mudar.
// Uso: node scripts/lancamentos-sql.mjs > /tmp/lancamentos.sql
const { RELEASES } = await import('../src/data.ts');

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const minuscula = s => s.charAt(0).toLowerCase() + s.slice(1);
const linhas = RELEASES.filter(r => !r.approx).map(r => {
  const d = r.date, h = d.h || 0;
  const texto = /^nos cinemas$/i.test(r.what)
    ? `Hoje estreia ${r.t} nos cinemas.`
    : `Hoje${d.h ? ` às ${d.h}h` : ''}: ${r.t}, ${minuscula(r.what)}.`;
  return `  (${q(r.id)}, make_timestamptz(${d.y}, ${d.m}, ${d.d}, ${h}, 0, 0, 'America/Sao_Paulo'), ${q(texto)})`;
});
console.log(`-- gerado por scripts/lancamentos-sql.mjs a partir de RELEASES (src/data.ts)
delete from app_private.lancamentos;
insert into app_private.lancamentos (title_id, quando, texto) values
${linhas.join(',\n')};`);
