import { NextResponse } from 'next/server';

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get('brand') || 'All Brands';
  const category = searchParams.get('category') || 'All Categories';
  const location = searchParams.get('location') || 'Pakistan';
  
  // Construct a query that forces it to find local sales
  let queryTerms = [];
  if (brand !== 'All Brands') queryTerms.push(brand);
  if (category !== 'All Categories') queryTerms.push(category);
  queryTerms.push("sale", "discount", "Pakistan");
  
  const query = encodeURIComponent(queryTerms.join(" "));
  
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      next: { revalidate: 300 } // cache for 5 mins
    });
    
    if (!res.ok) {
      throw new Error('Search engine responded with ' + res.status);
    }
    
    const html = await res.text();
    
    const results = [];
    const blockRegex = /<div class="result__body">([\s\S]*?)<\/div>\s*<\/div>/gi;
    let match;
    
    while ((match = blockRegex.exec(html)) !== null) {
      const block = match[1];
      
      const titleMatch = block.match(/<h2 class="result__title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/<a class="result__snippet[^>]*>([\s\S]*?)<\/a>/i);
      
      if (titleMatch && snippetMatch) {
         let rawTitle = decodeHtmlEntities(titleMatch[1].replace(/<\/?[^>]+(>|$)/g, "")).trim();
         let rawSnippet = decodeHtmlEntities(snippetMatch[1].replace(/<\/?[^>]+(>|$)/g, "")).trim();
         
         if (!rawTitle || !rawSnippet) continue;
         
         // Extract some discount keywords
         let discountStr = "HOT DEAL";
         const pctMatch = rawSnippet.match(/\b(\d{1,3}%(?:\s*off)?)\b/i) || rawTitle.match(/\b(\d{1,3}%(?:\s*off)?)\b/i);
         const flatMatch = rawSnippet.match(/\b(flat\s*\d+%?)\b/i) || rawTitle.match(/\b(flat\s*\d+%?)\b/i);
         const upToMatch = rawSnippet.match(/\b(up to\s*\d+%?)\b/i) || rawTitle.match(/\b(up to\s*\d+%?)\b/i);
         
         if (pctMatch) discountStr = pctMatch[1].toUpperCase();
         else if (flatMatch) discountStr = flatMatch[1].toUpperCase();
         else if (upToMatch) discountStr = upToMatch[1].toUpperCase();
         else if (rawSnippet.toLowerCase().includes('clearance')) discountStr = "CLEARANCE";
         
         results.push({
           id: crypto.randomUUID(),
           brand: brand !== 'All Brands' ? brand : (rawTitle.split(/[ -]/)[0] || 'Brand'),
           title: rawTitle.length > 50 ? rawTitle.substring(0, 50) + '...' : rawTitle,
           discount: discountStr,
           snippet: rawSnippet.length > 90 ? rawSnippet.substring(0, 90) + '...' : rawSnippet,
           tag: "Web Search"
         });
      }
    }
    
    if (results.length === 0) {
      return NextResponse.json([{
         id: "1", 
         brand: brand !== 'All Brands' ? brand : 'Local Store', 
         title: "Check local stores for unadvertised sales.", 
         discount: "STORE VISIT", 
         snippet: "No live web results found for this specific search. Visit physical store.", 
         tag: "Offline"
      }]);
    }
    
    return NextResponse.json(results.slice(0, 6)); // Top 6 real results
    
  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json({ error: 'Failed to search live deals' }, { status: 500 });
  }
}
