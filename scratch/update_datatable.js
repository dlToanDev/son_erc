const fs = require('fs');
const path = 'apps/web/src/components/DataTable.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/<div className="mobile-card-list">[\s\S]*?<\/div>\s*<\/div>/, `<div className="mobile-card-list">
        {loading && rows.length === 0 && (
          <div className="table-empty" style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="skeleton" style={{ height: '80px', borderRadius: '12px', marginBottom: '1rem' }} />
            <div className="skeleton" style={{ height: '80px', borderRadius: '12px', marginBottom: '1rem' }} />
            <div className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
          </div>
        )}
        {(!loading || rows.length > 0) && error && (
          <div className="table-empty text-danger" style={{ padding: '1.5rem', textAlign: 'center' }}>
            Không tải được dữ liệu — thử tải lại trang
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="table-empty" style={{ padding: '1.5rem', textAlign: 'center' }}>
            {emptyText}
          </div>
        )}
        {(!loading || rows.length > 0) &&
          !error &&
          rows.map((row) => {
            // Xác định cột hành động (thường là cột cuối cùng, không có header hoặc header là 'Thao tác')
            const actionCol = columns.find(c => c.header === 'Thao tác' || c.header === '');
            const otherCols = columns.filter(c => c !== actionCol);
            
            return (
              <div
                key={rowKey(row)}
                className={\`mobile-card \${onRowClick ? 'clickable' : ''}\`}
                onClick={() => onRowClick?.(row)}
              >
                {otherCols.map((col, idx) => (
                  <div key={col.key} className={idx === 0 ? "card-row card-header-row" : "card-row"}>
                    <span className="card-label">{col.header}</span>
                    <span className="card-value">{col.render(row)}</span>
                  </div>
                ))}
                {actionCol && (
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    {actionCol.render(row)}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>`);

fs.writeFileSync(path, code);
