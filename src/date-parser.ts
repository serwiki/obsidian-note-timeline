export type DateMatch = { date: string; line: number; start: number; end: number; excerpt: string };
export const FORMATS = ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY', 'YYYY-MM-DD'] as const;
const patterns: Record<string, { re: RegExp; order: 'dmy'|'ymd' }> = {
  'DD/MM/YYYY': {re: /(?<!\d)(\d{2})\/(\d{2})\/(\d{4})(?!\d)/g, order: 'dmy'},
  'DD-MM-YYYY': {re: /(?<!\d)(\d{2})-(\d{2})-(\d{4})(?!\d)/g, order: 'dmy'},
  'DD.MM.YYYY': {re: /(?<!\d)(\d{2})\.(\d{2})\.(\d{4})(?!\d)/g, order: 'dmy'},
  'YYYY-MM-DD': {re: /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g, order: 'ymd'}
};
function validIso(a: string,b: string,c: string, order: 'dmy'|'ymd'): string | null {
  const [y,m,d] = order==='dmy'?[Number(c),Number(b),Number(a)]:[Number(a),Number(b),Number(c)];
  const date = new Date(Date.UTC(y,m-1,d));
  if (y<1000 || date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d) return null;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
export function parseNote(content: string, formats: string[], onlyStandalone: boolean): DateMatch[] {
  const matches: DateMatch[] = [];
  let offset = 0;
  const lines = content.split(/\n/);
  for(let line=0;line<lines.length;line++) {
    const text=lines[line];
    for(const format of formats) {
      const spec=patterns[format]; if(!spec) continue;
      const re=new RegExp(spec.re.source,'g');
      for(const m of text.matchAll(re)) {
        const iso=validIso(m[1],m[2],m[3],spec.order); if(!iso)continue;
        if(onlyStandalone && !/^(?:\s{0,3}#{1,6}\s*)?\s*$/.test(text.slice(0,m.index)) ) continue;
        if(onlyStandalone && !/^\s*$/.test(text.slice(m.index!+m[0].length)))continue;
        matches.push({date:iso,line,start:offset+m.index!,end:offset+m.index!+m[0].length,excerpt:''});
      }
    }
    offset+=text.length+1;
  }
  const uniq=[...new Map(matches.map(m=>[`${m.start}:${m.date}`,m])).values()].sort((a,b)=>a.start-b.start);
  for(let i=0;i<uniq.length;i++) {
    const from=uniq[i].end;
    const to=i+1<uniq.length?uniq[i+1].start:content.length;
    uniq[i].excerpt=content.slice(from,to).trim();
  }
  return uniq;
}
export function formatDate(date: Date,format: string):string {
  const d=String(date.getDate()).padStart(2,'0'), m=String(date.getMonth()+1).padStart(2,'0'),y=String(date.getFullYear());
  return format.replace('YYYY',y).replace('DD',d).replace('MM',m);
}
export function localToday(): string {return formatDate(new Date(),'YYYY-MM-DD');}
