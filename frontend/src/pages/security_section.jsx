import { useState, useRef, useEffect } from "react";
import { SendData } from './services/send_record';
import PatternGame from "./pattern_trajectory";
import CircularUnlock from "./circular_lock";
import "./styles/security_section.scss";

export default function Record() {
    const [mode, setMode] = useState("pattern"); 
    const [isDragging, setIsDragging] = useState(false);
    const [record, setRecord] = useState([]);
    const [score, setScore] = useState(0);
    const [_error_mean, set_Error_Mean] = useState(0.0);
    const [isSending, setIsSending] = useState(false);
    
    const areaRef = useRef(null);
    const last_ts = useRef(performance.now());
    
    const MAX_QUEUE_SIZE = 400; 
    const tolerance = 0.001;

    // 초기화 함수
    const stop_and_reset = () => {
        setIsDragging(false);
        setRecord([]);
        setScore(0);
    };

    // 마우스 누를 때 수집 시작
    const handle_press_start = () => {
        if (isSending) return;
        setIsDragging(true);
        last_ts.current = performance.now();
    };

    // 마우스 떼거나 영역 이탈 시 초기화
    const handle_press_end = () => {
        if (!isSending) {
            stop_and_reset();
        }
    };

    const on_handle_move = (e) => {
        if (isDragging && !isSending && record.length < MAX_QUEUE_SIZE && areaRef.current) {
            const now_ts = performance.now();
            const delta = (now_ts - last_ts.current) / 1000;

            if (delta >= tolerance) {
                const rect = areaRef.current.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                if (clientX === undefined || clientY === undefined) return;

                const data = {
                    timestamp: new Date().toISOString(),
                    x: Math.round(clientX - rect.left),
                    y: Math.round(clientY - rect.top),
                    deltatime: Number(delta.toFixed(4))
                };

                last_ts.current = now_ts;
                setRecord(prev => (prev.length >= MAX_QUEUE_SIZE ? prev : [...prev, data]));
            }
        }
    };

    useEffect(() => {
        const fetchSend = async () => {
            if (isSending || record.length < MAX_QUEUE_SIZE) return;

            try {
                setIsSending(true);
                const dataToSend = [...record]; 
                
                // 전송 시작 시 즉시 상태 초기화하여 중복 수집 방지
                setRecord([]); 
                setScore(0);
                setIsDragging(false);

                const result = await SendData(dataToSend);
                if (result) set_Error_Mean(result.toFixed(4));
            } catch (err) {
                console.error("Transmission failed:", err);
            } finally {
                setTimeout(() => setIsSending(false), 800); 
            }
        };
        fetchSend();
    }, [record.length, isSending]);

    return (
        <div className="security-container">
            <div className="mode-selector">
                <button className={mode === "pattern" ? "active" : ""} onClick={() => { setMode("pattern"); stop_and_reset(); }}>Pattern</button>
                <button className={mode === "circular" ? "active" : ""} onClick={() => { setMode("circular"); stop_and_reset(); }}>Circular</button>
            </div>

            {isSending && (
                <div className="loading-overlay">
                    <div className="loader"></div>
                    <p>분석 및 전송 중...</p>
                </div>
            )}

            <div className={`content-wrapper ${isSending ? 'blur' : ''}`}>
                <header className="security-header">
                    <div className="stat-box"><span className="label">SCORE</span><span className="value">{score}</span></div>
                    <div className="stat-box highlighted">
                        <span className="label">POINTS</span>
                        <span className="value">{record.length} / {MAX_QUEUE_SIZE}</span>
                        <div className="progress-bar"><div className="fill" style={{ width: `${(record.length / MAX_QUEUE_SIZE) * 100}%` }}></div></div>
                    </div>
                    <div className="stat-box"><span className="label">ERROR</span><span className="value">{Number(_error_mean * 100).toFixed(2)} %</span></div>
                </header>

                <main 
                    className="security-area"
                    ref={areaRef} 
                    onMouseMove={on_handle_move}
                    onTouchMove={on_handle_move}
                    // 핵심: 마우스 동작에 따른 생명주기 관리
                    onMouseDown={handle_press_start}
                    onMouseUp={handle_press_end}
                    onMouseLeave={handle_press_end} // 영역 벗어나면 즉시 초기화
                    onTouchStart={handle_press_start}
                    onTouchEnd={handle_press_end}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {mode === "pattern" ? (
                        <PatternGame isDragging={isDragging} setIsDragging={setIsDragging} setScore={setScore} />
                    ) : (
                        <CircularUnlock isDragging={isDragging} setIsDragging={setIsDragging} setScore={setScore} />
                    )}
                </main>

                <footer className="security-panel">
                    <div className="status-indicator">
                        <div className={`dot ${isDragging ? 'active' : ''}`}></div>
                        <span>{isDragging ? '수집 중 (마우스를 떼면 초기화)' : '대기 상태 (눌러서 수집 시작)'}</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}