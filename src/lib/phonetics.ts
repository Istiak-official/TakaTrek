export function getPhoneticKey(str: string): string {
  // Convert to lowercase and normalize
  str = str.toLowerCase();
  
  // Normalize Bengali 'y' character variations
  str = str.replace(/য\u09bc/g, 'য়');
  
  // Replace English vowel combinations & duplicates
  str = str.replace(/ee/g, 'i')
           .replace(/oo/g, 'u')
           .replace(/ph/g, 'f')
           .replace(/gh/g, 'g')
           .replace(/kh/g, 'k')
           .replace(/sh/g, 's')
           .replace(/ch/g, 'c')
           .replace(/th/g, 't')
           .replace(/dh/g, 'd')
           .replace(/bh/g, 'b');

  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    // Map Bengali consonants
    if (/[ম]/i.test(char)) result += 'm';
    else if (/[বভ]/i.test(char)) result += 'b';
    else if (/[ত্থটঠদধডঢৎ]/i.test(char)) result += 'd'; // group all t/d sounds
    else if (/[কখ]/i.test(char)) result += 'k';
    else if (/[গঘ]/i.test(char)) result += 'g';
    else if (/[চছ]/i.test(char)) result += 'c';
    else if (/[জঝয]/i.test(char)) result += 'j';
    else if (/[পফ]/i.test(char)) result += 'p';
    else if (/[রলড়ঢ়]/i.test(char)) result += 'l'; // group r/l sounds
    else if (/[সশষ]/i.test(char)) result += 's';
    else if (/[নণংঞঙ]/i.test(char)) result += 'n';
    else if (/[হ]/i.test(char)) result += 'h';
    else if (/[ওয়য়]/i.test(char)) result += 'w';
    
    // Map English characters to normalized consonants
    else if (/[m]/i.test(char)) result += 'm';
    else if (/[bv]/i.test(char)) result += 'b';
    else if (/[dt]/i.test(char)) result += 'd';
    else if (/[kq]/i.test(char)) result += 'k';
    else if (/[g]/i.test(char)) result += 'g';
    else if (/[c]/i.test(char)) result += 'c';
    else if (/[jz]/i.test(char)) result += 'j';
    else if (/[pf]/i.test(char)) result += 'p';
    else if (/[rl]/i.test(char)) result += 'l';
    else if (/[s]/i.test(char)) result += 's';
    else if (/[n]/i.test(char)) result += 'n';
    else if (/[h]/i.test(char)) result += 'h';
    else if (/[wy]/i.test(char)) result += 'w';
  }
  
  // Remove adjacent duplicate sounds
  let finalResult = '';
  for (let i = 0; i < result.length; i++) {
    if (i === 0 || result[i] !== result[i - 1]) {
      finalResult += result[i];
    }
  }
  return finalResult;
}
