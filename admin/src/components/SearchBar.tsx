interface SearchBarProps {
  keyword: string;
  onKeywordChange: (v: string) => void;
  onSearch: () => void;
  placeholder?: string;
  children?: React.ReactNode;
}
export default function SearchBar({
  keyword,
  onKeywordChange,
  onSearch,
  placeholder,
  children,
}: SearchBarProps) {
  return (
    <div className="search-bar">
      {" "}
      <input
        className="input search-input"
        placeholder={placeholder || "搜索..."}
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSearch()}
      />{" "}
      {children}{" "}
      <button className="btn btn-primary" onClick={onSearch}>
        {" "}
        搜索{" "}
      </button>{" "}
      <style>{`        .search-bar {          display: flex;          gap: 8px;          align-items: center;          margin-bottom: 16px;          flex-wrap: wrap;        }        .search-input { width: 220px; }      `}</style>{" "}
    </div>
  );
}
