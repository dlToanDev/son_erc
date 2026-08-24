const fs = require('fs');
const path = 'apps/web/src/pages/LoginPage.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace("import { useNavigate } from 'react-router-dom';", "import { useNavigate } from 'react-router-dom';\nimport { Loader2 } from 'lucide-react';");

code = code.replace(
  "{loading ? 'Đang đăng nhập…' : 'Đăng nhập'}",
  "loading ? <span style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem'}}><Loader2 size={18} className=\"animate-spin\" /> Đang đăng nhập...</span> : 'Đăng nhập'"
);

fs.writeFileSync(path, code);
