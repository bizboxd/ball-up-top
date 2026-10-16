// Exact usernames nobody can claim (case-insensitive, exact match only:
// "messi" is reserved, "messi10" or "leo.messi" are fine).
// The database enforces the same list (supabase/migrations/004_reserved_usernames.sql).
export const RESERVED_USERNAMES = [
  // Soccer
  "messi", "leomessi", "lionelmessi", "ronaldo", "cristiano", "cristianoronaldo", "cr7", "neymar", "neymarjr",
  "hazard", "edenhazard", "mbappe", "kylianmbappe", "haaland", "erlinghaaland", "salah", "mosalah", "debruyne",
  "kdb", "lewandowski", "benzema", "modric", "harrykane", "bellingham", "vinicius", "viniciusjr", "vini",
  "yamal", "lamineyamal", "pedri", "gavi", "saka", "foden", "rashford", "sonheungmin", "griezmann",
  "pogba", "kante", "suarez", "luissuarez", "ibrahimovic", "zlatan", "sergioramos", "vandijk", "alisson",
  "courtois", "neuer", "buffon", "iniesta", "xavi", "zidane", "ronaldinho", "kaka", "pele", "maradona", "beckham",
  "rooney", "thierryhenry", "drogba", "pirlo", "totti", "puyol", "casillas", "lampard", "gerrard",
  "rivaldo", "figo", "cruyff", "musiala", "wirtz", "osimhen", "lautaro", "julianalvarez", "dembele",
  "kvaratskhelia", "rodri", "valverde", "colepalmer", "odegaard", "martinelli", "sadiomane",
  "pulisic", "mcKennie", "alphonsodavies", "alexmorgan", "rapinoe", "putellas", "bonmati", 
  // Basketball
  "lebron", "lebronjames", "kingjames", "curry", "stephcurry", "stephencurry", "durant", "kevindurant", "kd",
  "giannis", "jokic", "embiid", "doncic", "luka", "lukadoncic", "tatum", "jaysontatum", "antman",
  "wemby", "wembanyama", "shai", "sga", "morant", "jamorant", "jimmybutler", "harden", "jamesharden",
  "westbrook", "kawhi", "lillard", "damianlillard", "dame", "booker", "devinbooker", "irving", "kyrie", "zion",
  "jordan", "michaeljordan", "mj", "kobe", "kobebryant", "shaq", "shaquille", "magicjohnson", 
  "larrybird", "duncan", "timduncan", "kareem", "wilt", "iverson", "nowitzki", "dwyanewade",
  "garnett", "pippen", "rodman", "barkley", "olajuwon", "brunson", "haliburton", "bronny", "caitlinclark",
  "ajawilson", "breannastewart", "taurasi", "angelreese",
  // Volleyball
  "giba", "ngapeth", "earvinngapeth", "wilfredoleon", "zaytsev", "kurek", "kirakaraly", "karch",
  "karchkiraly", "egonu", "paolaegonu", "boskovic", "melissavargas", "zhuting", 
  // Other big names
  "brady", "tombrady", "mahomes", "patrickmahomes", "ohtani", "aaronjudge", "usainbolt",
  "federer", "nadal", "djokovic", "serena", "serenawilliams", "tigerwoods", "phelps", "simonebiles", "mcgregor",
  // App and brand words
  "whocooked", "who_cooked", "whocookedapp", "admin", "administrator", "support", "help", "official", "team",
  "staff", "moderator", "mod", "root", "system", "null", "undefined", "anonymous", "everyone", "sportsboxd",
  "bizboxd", "ref", "referee",
].map((u) => u.toLowerCase());

const SET = new Set(RESERVED_USERNAMES);
export const isReservedUsername = (u) => SET.has(String(u || "").trim().toLowerCase());
