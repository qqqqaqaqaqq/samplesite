import { useState, useRef, useEffect } from "react";
import { SendData } from './services/send_record';
import PatternGame from "./pattern_trajectory";
import "./styles/security_section.scss";

export default function Record() {
    const [isDragging, setIsDragging] = useState(false);
    const [record, setRecord] = useState([]);
    const [_error_mean, set_Error_Mean] = useState(0.0);
    const [isSending, setIsSending] = useState(false);
    const [score, setScore] = useState(0);
    const areaRef = useRef(null);
    const last_ts = useRef(performance.now());
    
    const MAX_QUEUE_SIZE = 350;
    const tolerance = 0.001;

    // 모든 기록 초기화 함수
    const stop_and_reset = () => {
        setIsDragging(false);
        if (!isSending) {
            setRecord([]);
            setScore(0);
        }
    };

    // 모바일 터치 이탈 감지를 위한 가드 로직
    const handle_touch_move = (e) => {
        if (!isDragging || isSending || !areaRef.current) return;

        const rect = areaRef.current.getBoundingClientRect();
        const touch = e.touches[0];

        // 손가락 좌표가 영역(rect)을 벗어났는지 강제 체크
        if (
            touch.clientX < rect.left || 
            touch.clientX > rect.right || 
            touch.clientY < rect.top || 
            touch.clientY > rect.bottom
        ) {
            stop_and_reset();
            return;
        }

        // 영역 안이라면 데이터 수집 실행
        on_handle_move(e);
    };

    const on_handle_move = (e) => {
        if (isDragging && !isSending && record.length < MAX_QUEUE_SIZE && areaRef.current) {
            const now_ts = performance.now();
            const delta = (now_ts - last_ts.current) / 1000;

            if (delta >= tolerance) {
                const rect = areaRef.current.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                const relX = Math.round(clientX - rect.left);
                const relY = Math.round(clientY - rect.top);

                const data = {
                    timestamp: new Date().toISOString(),
                    x: relX, y: relY,
                    deltatime: Number(delta.toFixed(4))
                };

                last_ts.current = now_ts;
                setRecord(prev => (prev.length >= MAX_QUEUE_SIZE ? prev : [...prev, data]));
            }
        }
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mouseup", stop_and_reset);
            window.addEventListener("touchend", stop_and_reset);
            window.addEventListener("touchcancel", stop_and_reset); // 시스템 팝업 등 대응
        }
        return () => {
            window.removeEventListener("mouseup", stop_and_reset);
            window.removeEventListener("touchend", stop_and_reset);
            window.removeEventListener("touchcancel", stop_and_reset);
        };
    }, [isDragging, isSending]);

    useEffect(() => {
        const fetchSend = async () => {
            if (isSending || record.length < MAX_QUEUE_SIZE) return;
            try {
                setIsSending(true);
                const dataToSend = [...record];
                setRecord([]); 
                setScore(0);
                setIsDragging(false);
                const result = await SendData(dataToSend);
                if (result) set_Error_Mean(result.toFixed(4));
            } catch (err) {
                console.error("전송 에러:", err);
            } finally {
                setTimeout(() => setIsSending(false), 1000); 
            }
        };
        fetchSend();
    }, [record.length]);

    return (
        <div className="security-container">
            {isSending && (
                <div className="loading-overlay">
                    <div className="loader"></div>
                    <p>패턴 분석 중...</p>
                </div>
            )}

            <div className={`content-wrapper ${isSending ? 'blur' : ''}`}>
                <header className="security-header">
                    <div className="stat-box"><span className="label">SCORE</span><span className="value">{score}</span></div>
                    <div className="stat-box highlighted">
                        <span className="label">POINTS</span>
                        <span className="value">{Math.min(record.length, MAX_QUEUE_SIZE)}</span>
                        <div className="progress-bar">
                            <div className="fill" style={{ width: `${(Math.min(record.length, MAX_QUEUE_SIZE) / MAX_QUEUE_SIZE) * 100}%` }}></div>
                        </div>
                    </div>
                    <div className="stat-box"><span className="label">ERROR</span><span className="value">{_error_mean}</span></div>
                </header>

                <main 
                    className="security-area"
                    ref={areaRef} 
                    onMouseMove={on_handle_move}
                    onTouchMove={handle_touch_move} // 개선된 터치 무브 적용
                    onMouseLeave={stop_and_reset}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <PatternGame 
                        isDragging={isDragging} 
                        setIsDragging={setIsDragging}
                        setScore={setScore}
                    />
                </main>

                <footer className="security-panel">
                    <div className="status-indicator">
                        <div className={`dot ${isDragging ? 'active' : ''}`}></div>
                        <span>{isDragging ? 'RECORDING...' : 'HOLD TO START'}</span>
                    </div>
                    <p className="hint">손을 떼거나 영역을 벗어나면 초기화됩니다.</p>
                </footer>
            </div>
        </div>
    );
}