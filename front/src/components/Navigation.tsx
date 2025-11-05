import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navigation() {
  const router = useRouter();
  const activeClass = "text-blue-600 font-bold scale-105 drop-shadow-glow-text"; // 활성화: 파란색 글씨, 굵게, 살짝 커짐, 글로우 효과

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isActive = router.pathname === href;
    return (
      <Link href={href} passHref legacyBehavior>
        <a className={`px-4 py-2 rounded-lg text-base font-semibold cursor-pointer
          transition-all duration-200
          ${isActive 
            ? activeClass 
            : 'text-gray-700 hover:text-blue-600'
          }`}>
          {children}
        </a>
      </Link>
    );
  };

  return (
    <nav className="w-full flex justify-center items-center my-6 select-none">
      <div
        className="flex items-center gap-2 p-2 rounded-full bg-white/60 shadow-lg border border-white/50 backdrop-blur-lg"
      >
        {/* 왼쪽 메뉴 */}
        <NavLink href="/dashboard">대시보드</NavLink>
        <NavLink href="/widget-store">위젯스토어</NavLink>

        {/* 중앙 로고 */}
        <Link href="/about" passHref legacyBehavior>
          <a className="mx-2 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-900 to-cyan-400 w-11 h-11 text-2xl text-white font-extrabold border-2 border-white/50 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer">
            <span className="drop-shadow-glow">★</span>
          </a>
        </Link>

        {/* 오른쪽 메뉴 */}
        <NavLink href="/diary/calendar">일기</NavLink>
        <NavLink href="/mypage">마이페이지</NavLink>
      </div>
      <style jsx>{`
        .drop-shadow-glow {
          filter: drop-shadow(0 0 5px #fff) drop-shadow(0 0 8px #38bdf8);
        }
        .drop-shadow-glow-text {
          filter: drop-shadow(0 0 2px #3b82f6) drop-shadow(0 0 4px #3b82f6) drop-shadow(0 0 6px #3b82f6) drop-shadow(0 0 8px #3b82f6);
          text-shadow: 0 0 10px #3b82f6, 0 0 20px #3b82f6;
        }
      `}</style>
    </nav>
  );
}