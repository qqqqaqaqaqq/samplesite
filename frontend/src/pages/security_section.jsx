import { useState, useRef, useEffect } from "react";
import { SendData } from './services/send_record';
import PatternGame from "./pattern_trajectory";
import CircularUnlock from "./circular_lock";
import SimpleDrawing from "./simple_drawing";
import "./styles/security_section.scss";

export default function Record() {

    const [mode, setMode] = useState("pattern");
    const [isDragging, setIsDragging] = useState(false);
    const [record, setRecord] = useState([]);
    const [score, setScore] = useState(0);
    const [_error_mean, set_Error_Mean] = useState(0.0);
    const [isSending, setIsSending] = useState(false);
    const [countdown, setCountdown] = useState(null);

    const areaRef = useRef(null);
    const last_ts = useRef(performance.now());
    const isProcessing = useRef(false);
    const idleTimer = useRef(null);
    const countdownInterval = useRef(null);
    const isDraggingRef = useRef(false);
    const recordRef = useRef([]);
    const handle_press_end_ref = useRef(null);

    const MAX_QUEUE_SIZE = 120;
    const tolerance = 0.001;
    const IDLE_TIMEOUT = 2000;

    const clear_countdown = () => {
        if (countdownInterval.current) {
            clearInterval(countdownInterval.current);
            countdownInterval.current = null;
        }
        setCountdown(null);
    };

    const start_countdown = () => {
        clear_countdown();
        const start = performance.now();
        setCountdown(IDLE_TIMEOUT);
        countdownInterval.current = setInterval(() => {
            const elapsed = performance.now() - start;
            const remaining = Math.max(0, Math.ceil(IDLE_TIMEOUT - elapsed));
            setCountdown(remaining);
            if (remaining <= 0) clear_countdown();
        }, 50);
    };

    const clear_idle_timer = () => {
        if (idleTimer.current) {
            clearTimeout(idleTimer.current);
            idleTimer.current = null;
        }
        clear_countdown();
    };

    const stop_and_clear = () => {
        clear_idle_timer();
        isDraggingRef.current = false;
        setIsDragging(false);
        setRecord([]);
        recordRef.current = [];
        setScore(0);
    };

    const handle_press_start = () => {
        if (isSending || isProcessing.current) return;
        clear_idle_timer();
        last_ts.current = performance.now();
        isDraggingRef.current = true;
        setIsDragging(true);
    };

    // 매 렌더마다 최신 함수로 교체
    handle_press_end_ref.current = async () => {
        if (!isDraggingRef.current) return;
        if (isSending || isProcessing.current) return;

        clear_idle_timer();
        isDraggingRef.current = false;
        setIsDragging(false);

        const currentRecord = recordRef.current;

        if (currentRecord.length >= MAX_QUEUE_SIZE) {
            try {
                isProcessing.current = true;
                setIsSending(true);

                const result = await SendData(currentRecord);
                if (result !== undefined) set_Error_Mean(result);

                setRecord([]);
                recordRef.current = [];
                setScore(0);

            } catch (err) {
                console.error("Transmission failed:", err);
            } finally {
                setTimeout(() => {
                    setIsSending(false);
                    isProcessing.current = false;
                }, 800);
            }
        } else if (currentRecord.length > 0) {
            start_countdown();
            idleTimer.current = setTimeout(() => {
                stop_and_clear();
            }, IDLE_TIMEOUT);
        }
    };

    useEffect(() => {
        const onWindowMouseUp = () => handle_press_end_ref.current();
        const onWindowTouchEnd = () => handle_press_end_ref.current();

        window.addEventListener("mouseup", onWindowMouseUp);
        window.addEventListener("touchend", onWindowTouchEnd);

        return () => {
            window.removeEventListener("mouseup", onWindowMouseUp);
            window.removeEventListener("touchend", onWindowTouchEnd);
        };
    }, []);

    useEffect(() => {
        return () => {
            clear_idle_timer();
        };
    }, []);

    const handle_context_menu = (e) => {
        e.preventDefault();
        if (isSending || isProcessing.current) return;
        if (!isDraggingRef.current) handle_press_start();
        else stop_and_clear();
    };

    const on_handle_move = (e) => {
        if (!isDraggingRef.current || isSending || isProcessing.current) return;

        clear_idle_timer();
        idleTimer.current = setTimeout(() => {
            stop_and_clear();
        }, IDLE_TIMEOUT);

        if (areaRef.current) {
            const now_ts = performance.now();
            const delta = (now_ts - last_ts.current) / 1000;

            if (delta >= tolerance) {
                const rect = areaRef.current.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                if (clientX === undefined || clientY === undefined) return;

                const newData = {
                    timestamp: new Date().toISOString(),
                    x: Math.round(clientX - rect.left),
                    y: Math.round(clientY - rect.top),
                    deltatime: Number(delta.toFixed(4))
                };

                last_ts.current = now_ts;

                setRecord(prev => {
                    const next = [...prev, newData];
                    recordRef.current = next;
                    return next;
                });
            }
        }
    };

    const currentProgress = Math.min(record.length / MAX_QUEUE_SIZE, 1);

    return (
        <div className="security-container">

            <div className="mode-selector">
                <button
                    className={mode === "pattern" ? "active" : ""}
                    onClick={() => { setMode("pattern"); stop_and_clear(); }}
                >Pattern</button>
                <button
                    className={mode === "circular" ? "active" : ""}
                    onClick={() => { setMode("circular"); stop_and_clear(); }}
                >Circular</button>
                <button
                    className={mode === "drawing" ? "active" : ""}
                    onClick={() => { setMode("drawing"); stop_and_clear(); }}
                >Drawing</button>
            </div>

            {isSending && (
                <div className="loading-overlay">
                    <div className="loader"></div>
                    <p>분석 중...</p>
                </div>
            )}

            <div className={`content-wrapper ${isSending ? 'blur' : ''}`}>

                <header className="security-header">

                    <div className="stat-box">
                        <span className="label">SCORE</span>
                        <span className="value">{score}</span>
                    </div>

                    <div className="stat-box highlighted">
                        <span className="label">POINTS</span>
                        <span className="value">{record.length} / {MAX_QUEUE_SIZE}</span>
                        <div className="progress-bar">
                            <div
                                className="fill"
                                style={{
                                    width: `${currentProgress * 100}%`,
                                    transition: "none"
                                }}
                            ></div>
                        </div>
                    </div>

                    <div className="stat-box">
                        <span className="label">ERROR</span>
                        <span className="value">{(Number(_error_mean) * 100).toFixed(2)} %</span>
                    </div>

                </header>

                <main
                    className="security-area"
                    ref={areaRef}
                    onMouseMove={on_handle_move}
                    onTouchMove={on_handle_move}
                    onMouseDown={(e) => { if (mode === "drawing" && e.button === 0) handle_press_start(); }}
                    onTouchStart={() => { if (mode === "drawing") handle_press_start(); }}
                    onContextMenu={handle_context_menu}
                >
                    {mode === "pattern" && (
                        <PatternGame
                            isDragging={isDragging}
                            setIsDragging={setIsDragging}
                            setScore={setScore}
                            onStart={handle_press_start}
                        />
                    )}
                    {mode === "circular" && (
                        <CircularUnlock
                            isDragging={isDragging}
                            setIsDragging={setIsDragging}
                            setScore={setScore}
                            onStart={handle_press_start}
                        />
                    )}
                    {mode === "drawing" && (
                        <SimpleDrawing
                            isDragging={isDragging}
                            setScore={setScore}
                        />
                    )}
                </main>

                <footer className="security-panel">
                    {/* 상태 표시 영역 */}
                    <div className="status-indicator">
                        <div className={`dot ${isDragging ? 'active' : ''}`}></div>
                        <div className="status-text">
                            <span>
                                {isDragging 
                                    ? '수집 중 (우클릭으로 초기화)' 
                                    : '대기 중'}
                            </span>
                            {!isDragging && countdown !== null && countdown > 0 && (
                                <span className="countdown-text">{countdown}ms 후 초기화</span>
                            )}
                        </div>
                    </div>

                    {/* 매크로 의심 기준 영역 */}
                    <div className="macro-criteria">
                        <h4>매크로 판단 기준</h4>
                        <ul>
                            <li>110% 이상 → 이상치 의심 (매크로 판단)</li>
                            <li>90% ~ 109% → 매크로 의심 (재요청 시 유지하면 매크로)</li>
                            <li>80% ~ 89% → 경계선</li>
                            <li>80% 이하 → 정상 휴먼</li>
                        </ul>
                    </div>
                </footer>


            </div>
        </div>
    );
}