import { useEffect, useRef } from 'react';
import { mobileNav, useMobileBack } from '../../utils/mobileNavigation';
import React, { useState } from 'react';
import { useContractStore } from '../../store/useContractStore';
import { CustomerDossierBar } from './CustomerDossierBar';
import { HistoryStep } from './HistoryStep';
import { FinanceAgreementStep } from './FinanceAgreementStep';
import { financeDocumentsComplete } from '../../domain/financeDocuments';
import {
  STEPS,
  usesGuarantor,
  checklist,
  photoLimit,
} from '../../domain/rules';
import {
  money,
  autoCalculateTerms,
  schedule,
  localDay,
} from '../../domain/calculations';
import {
  demoImage,
} from '../../domain/workflow';
import { getCurrentCoordinates } from '../../utils/geolocation';
import { resizeImageFile } from '../../utils/camera';
import { CameraCaptureModal, CameraGuideMode } from '../common/CameraCaptureModal';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle,
  Camera,
  MapPin,
  Sparkles,
  Send,
  Upload,
  X,
} from 'lucide-react';
export const FormWizard: React.FC = () => {
  const {
    activeDraft,
    activeStep,
    setActiveStep,
    updateActiveDraft,
    saveCurrentDraft,
    submitCurrentDraft,
    recordSaleCurrentDraft,
    selectDraft,
    user,
    showToast,
  } = useContractStore();

  const [confirmSaleModal, setConfirmSaleModal] = useState(false);
  const [saleDateInput, setSaleDateInput] = useState(localDay());
  const [gpsLoading, setGpsLoading] = useState(false);
  const [cameraModalConfig, setCameraModalConfig] = useState<{
    isOpen: boolean;
    key: string;
    label: string;
    mode: CameraGuideMode;
  } | null>(null);


  useMobileBack(true, () => selectDraft('', 0, 'tasks'), 'wizard-root');
  useMobileBack(!!cameraModalConfig?.isOpen, () => setCameraModalConfig(null), 'camera-modal');
  useMobileBack(confirmSaleModal, () => setConfirmSaleModal(false), 'confirm-sale-modal');

  const prevStepRef = useRef(activeStep);
  const stepSequenceRef = useRef(0);
  const stepHistoryRef = useRef<{ id: string; dispose: () => void }[]>([]);

  useEffect(() => {
    if (activeStep === prevStepRef.current) return;
    const fromStep = prevStepRef.current;
    const id = `wizard-step-${++stepSequenceRef.current}`;
    const dispose = mobileNav.push(id, () => {
      const index = stepHistoryRef.current.findIndex((entry) => entry.id === id);
      if (index !== -1) stepHistoryRef.current.splice(index, 1);
      // A history-driven step change consumes its existing entry, not a new visit.
      prevStepRef.current = fromStep;
      setActiveStep(fromStep);
    });
    stepHistoryRef.current.push({ id, dispose });
    prevStepRef.current = activeStep;
  }, [activeStep, setActiveStep]);

  useEffect(() => () => {
    for (const entry of stepHistoryRef.current) entry.dispose();
    stepHistoryRef.current = [];
  }, []);

  if (!activeDraft) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500">ไม่พบข้อมูลร่างสัญญา</p>
        <button
          type="button"
          onClick={() => selectDraft('', 0, 'tasks')}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold"
        >
          กลับหน้ารายการงาน
        </button>
      </div>
    );
  }

  const d = activeDraft;
  const isSalePhase = !d.soldAt;
  const checks = checklist(d, isSalePhase ? 'sale' : 'opening');
  const allOpeningOk = checklist(d, 'opening').every((c) => c.ok);

  const canGoPrev = activeStep > 0;
  const canGoNext = activeStep < STEPS.length - 1 && (activeStep !== 7 || financeDocumentsComplete(d));

  // Step 5 GPS native handler
  const handleGetGps = async () => {
    setGpsLoading(true);
    try {
      const coords = await getCurrentCoordinates();
      updateActiveDraft((draft) => {
        draft.location.lat = coords.lat;
        draft.location.lng = coords.lng;
        draft.location.link = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
      });
      showToast(`ดึงพิกัด GPS จริงสำเร็จ (${coords.lat}, ${coords.lng}) แม่นยำ ±${coords.accuracy}ม.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg);
    } finally {
      setGpsLoading(false);
    }
  };

  // Step 6 Photo upload handler with 1280px canvas compression
  const handlePhotoUpload = async (key: string, file: File) => {
    try {
      const compressedDataUrl = await resizeImageFile(file);
      updateActiveDraft((draft) => {
        if (!draft.photos[key]) draft.photos[key] = [];
        const limit = photoLimit(key);
        if (draft.photos[key].length >= limit) {
          showToast(`หมวดนี้แนบรูปได้สูงสุด ${limit} รูป`);
          return;
        }
        draft.photos[key].push({
          id: `${key}_${Date.now()}`,
          src: compressedDataUrl,
          name: file.name,
          at: new Date().toISOString(),
          by: user.name,
        });
      });
      showToast(`อัปโหลดรูปภาพ ${file.name} เรียบร้อย (บีบอัดอัตโนมัติ)`);
    } catch (err) {
      showToast('ไม่สามารถประมวลผลรูปภาพได้');
    }
  };

  // Step 6 Demo Photo add
  const handleAddDemoPhoto = (key: string, label: string) => {
    updateActiveDraft((draft) => {
      if (!draft.photos[key]) draft.photos[key] = [];
      const limit = photoLimit(key);
      if (draft.photos[key].length >= limit) {
        showToast(`หมวดนี้แนบรูปได้สูงสุด ${limit} รูป`);
        return;
      }
      draft.photos[key].push({
        id: `${key}_${Date.now()}`,
        src: demoImage(`${label} ${draft.photos[key].length + 1}`),
        name: `${label} (สาธิต)`,
        at: new Date().toISOString(),
        by: user.name,
        demo: true,
      });
    });
    showToast(`เพิ่มรูปภาพสาธิต ${label} แล้ว`);
  };

  const openLiveCamera = (key: string, label: string) => {
    let mode: CameraGuideMode = 'general';
    if (key === 'id' || key === 'guarantorId') {
      mode = 'idcard';
    } else if (key === 'buyer' || key === 'guarantor') {
      mode = 'portrait';
    }
    setCameraModalConfig({
      isOpen: true,
      key,
      label,
      mode,
    });
  };

  const handleLiveCameraCapture = (dataUrl: string, fileName: string) => {
    if (!cameraModalConfig) return;
    const { key, label } = cameraModalConfig;
    updateActiveDraft((draft) => {
      if (!draft.photos[key]) draft.photos[key] = [];
      const limit = photoLimit(key);
      if (draft.photos[key].length >= limit) {
        showToast(`หมวดนี้แนบรูปได้สูงสุด ${limit} รูป`);
        return;
      }
      draft.photos[key].push({
        id: `${key}_${Date.now()}`,
        src: dataUrl,
        name: fileName,
        at: new Date().toISOString(),
        by: user.name,
      });
    });
    showToast(`ถ่ายรูป ${label} สำเร็จ`);
  };

  const handleDeletePhoto = (key: string, photoId: string) => {
    updateActiveDraft((draft) => {
      if (draft.photos[key]) {
        draft.photos[key] = draft.photos[key].filter((p) => p.id !== photoId);
      }
    });
    showToast('ลบรูปภาพแล้ว');
  };


  // Renders the appropriate Step Form Content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return <HistoryStep key={d.id} />;

      case 1:
        // Step 1: ข้อมูลผู้เช่าซื้อและที่อยู่
        return (
          <div className="space-y-6">
            <div className="card p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">ข้อมูลติดต่อผู้เช่าซื้อ</h3>
              <div className="form-grid-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={d.buyer.phone}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.phone = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    เพศ <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={d.buyer.gender}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.gender = e.target.value as 'ชาย' | 'หญิง';
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="">เลือกเพศ</option>
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    วันเกิด <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={d.buyer.birth}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.birth = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">สถานภาพที่อยู่อาศัย</label>
                  <select
                    value={d.buyer.homeType}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.homeType = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="บ้านตนเอง">บ้านตนเอง</option>
                    <option value="บ้านเช่า">บ้านเช่า</option>
                    <option value="อยู่กับญาติ">อยู่กับญาติ</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">อายุ (ปี)</label>
                  <input
                    type="number"
                    placeholder="เช่น 30"
                    value={d.buyer.age ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.age = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">สัญชาติ</label>
                  <input
                    type="text"
                    placeholder="ไทย"
                    value={d.buyer.nationality ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.nationality = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">LINE ID</label>
                  <input
                    type="text"
                    placeholder="LINE ID ผู้ซื้อ"
                    value={d.buyer.lineId ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.lineId = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">ระยะเวลาที่พักอาศัย</label>
                  <input
                    type="text"
                    placeholder="เช่น 3 ปี"
                    value={d.buyer.residenceYears ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.residenceYears = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">อาศัยอยู่กับ</label>
                  <select
                    value={d.buyer.liveWith ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.liveWith = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="">เลือก</option>
                    <option value="คนเดียว">คนเดียว</option>
                    <option value="บิดามารดา">บิดามารดา</option>
                    <option value="คู่สมรส">คู่สมรส</option>
                    <option value="ญาติ">ญาติ</option>
                    <option value="เพื่อน">เพื่อน</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">จำนวนผู้อยู่อาศัยด้วย (คน)</label>
                  <input
                    type="number"
                    placeholder="เช่น 2"
                    value={d.buyer.dependentsCount ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.dependentsCount = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Address fields */}
            <div className="card p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">ที่อยู่ตามบัตรประชาชน</h3>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  บ้านเลขที่ / หมู่ / ซอย / ถนน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={d.buyer.address}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.address = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="form-grid-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ตำบล / แขวง <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={d.buyer.subdistrict}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.subdistrict = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    อำเภอ / เขต <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={d.buyer.district}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.district = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    จังหวัด <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={d.buyer.province}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.province = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    รหัสไปรษณีย์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={d.buyer.postcode}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.buyer.postcode = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        // Step 2: การงานและรายได้
        return (
          <div className="card p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">ข้อมูลอาชีพและสถานที่ทำงาน</h3>
            <div className="form-grid-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  อาชีพ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={d.buyer.job}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.job = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ชื่อบริษัท / สถานที่ทำงาน <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={d.buyer.company}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.company = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  รายได้ประจำต่อเดือน (บาท) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={d.buyer.income}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.income = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">เบอร์โทรที่ทำงาน</label>
                <input
                  type="tel"
                  value={d.buyer.workPhone}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.workPhone = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ตำแหน่ง</label>
                <input
                  type="text"
                  placeholder="เช่น พนักงานขาย, เจ้าหน้าที่"
                  value={d.buyer.position ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.position = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">อายุงาน</label>
                <input
                  type="text"
                  placeholder="เช่น 2 ปี 6 เดือน"
                  value={d.buyer.tenure ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.tenure = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">รายได้อื่นๆ (บาท)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={d.buyer.otherIncome ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.otherIncome = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ประเภทธุรกิจ</label>
                <select
                  value={d.buyer.businessType ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.businessType = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="">เลือกประเภทธุรกิจ</option>
                  <option value="บริษัทเอกชน">บริษัทเอกชน</option>
                  <option value="รับราชการ">รับราชการ</option>
                  <option value="รัฐวิสาหกิจ">รัฐวิสาหกิจ</option>
                  <option value="ธุรกิจส่วนตัว">ธุรกิจส่วนตัว</option>
                  <option value="อาชีพอิสระ">อาชีพอิสระ</option>
                  <option value="รับจ้างชั่วคราว">รับจ้างชั่วคราว</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">แผนก</label>
                <input
                  type="text"
                  placeholder="เช่น แผนกบัญชี / บริการ"
                  value={d.buyer.workDepartment ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.workDepartment = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">เวลาที่สะดวกติดต่อ</label>
                <input
                  type="text"
                  placeholder="เช่น 09:00 - 18:00 น."
                  value={d.buyer.contactTime ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.contactTime = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">สถานที่ทำงานเดิม (ถ้าปัจจุบันต่ำกว่า 6 เดือน)</label>
                <input
                  type="text"
                  placeholder="ชื่อบริษัทหรือสถานที่ทำงานเดิม"
                  value={d.buyer.previousCompany ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.buyer.previousCompany = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                ที่อยู่สถานที่ทำงาน <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={d.buyer.workAddress}
                onChange={(e) =>
                  updateActiveDraft((draft) => {
                    draft.buyer.workAddress = e.target.value;
                  })
                }
                className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        );

      case 3:
        // Step 3: ผู้ค้ำประกัน
        if (!usesGuarantor(d)) {
          return (
            <div className="p-6 text-center bg-white rounded-2xl border border-slate-200">
              <span className="badge green mb-2">สดพิเศษ</span>
              <h3 className="text-base font-bold text-slate-800">ข้อยกเว้น: ไม่ต้องใช้ผู้ค้ำประกัน</h3>
              <p className="text-xs text-slate-500 mt-1">
                สำหรับสัญญาสดพิเศษ ไม่ต้องกรอกข้อมูลผู้ค้ำประกัน สามารถข้ามไปขั้นตอนถัดไปได้ทันที
              </p>
            </div>
          );
        }
        return (
          <div className="card p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">ข้อมูลผู้ค้ำประกัน</h3>
            <div className="form-grid-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ชื่อ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={d.guarantor.first}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.first = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  นามสกุล <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={d.guarantor.last}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.last = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  เบอร์โทรผู้ค้ำ <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={d.guarantor.phone}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.phone = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ความสัมพันธ์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={d.guarantor.relation}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.relation = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">อายุผู้ค้ำ (ปี)</label>
                <input
                  type="number"
                  placeholder="เช่น 35"
                  value={d.guarantor.age ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.age = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">LINE ID ผู้ค้ำ</label>
                <input
                  type="text"
                  placeholder="LINE ID ผู้ค้ำ"
                  value={d.guarantor.lineId ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.lineId = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ระยะเวลาที่พักอาศัย</label>
                <input
                  type="text"
                  placeholder="เช่น 5 ปี"
                  value={d.guarantor.residenceYears ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.residenceYears = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">ตำแหน่งงาน</label>
                <input
                  type="text"
                  placeholder="ตำแหน่งงานผู้ค้ำ"
                  value={d.guarantor.position ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.position = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">เบอร์โทรที่ทำงานผู้ค้ำ</label>
                <input
                  type="tel"
                  placeholder="เบอร์โทรที่ทำงาน"
                  value={d.guarantor.workPhone ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.workPhone = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">อายุงานผู้ค้ำ</label>
                <input
                  type="text"
                  placeholder="เช่น 3 ปี"
                  value={d.guarantor.tenure ?? ''}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.guarantor.tenure = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>
          </div>
        );

      case 4:
        // Step 4: สินค้าและงวดผ่อน (พร้อม Live Calculation Box เด่นชัด!)
        const scheduleRows = schedule(d.terms);
        return (
          <div className="space-y-6">
            {/* Live Calculation Box */}
            <div className="card p-4 md:p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-red-600 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-red-600 shrink-0" />
                <span>สรุปการคำนวณทางการเงิน (คำนวณสดทันที)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-medium block mb-1">
                    ยอดจัดสัญญาคำนวณสด (ราคา - ดาวน์)
                  </span>
                  <strong className="text-xl sm:text-2xl font-black text-slate-900 mono block whitespace-nowrap">
                    ฿{money(d.terms.principal)}
                  </strong>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs text-slate-500 font-medium block mb-1">
                    แผนผ่อนชำระ (ยอดจัด ÷ จำนวนงวด)
                  </span>
                  <strong className="text-base sm:text-lg font-bold text-red-600 mono block whitespace-nowrap">
                    {d.terms.monthly ? `฿${money(d.terms.monthly)} × ${d.terms.months || '-'} งวด` : '-'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="card p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">รายละเอียดสินค้าและข้อตกลงสินเชื่อ</h3>
              <div className="form-grid-2">
                <div className="col-span-full">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ชื่อสินค้า / ยี่ห้อ / รุ่น <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={d.terms.product}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.product = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ราคาสินค้า (บาท) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={d.terms.price}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.price = e.target.value;
                        autoCalculateTerms(draft.terms, 'price');
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    เงินดาวน์ (บาท) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={d.terms.down}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.down = e.target.value;
                        autoCalculateTerms(draft.terms, 'down');
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    จำนวนงวดผ่อน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={d.terms.months}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.months = e.target.value;
                        autoCalculateTerms(draft.terms, 'months');
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    วันชำระงวดแรก (30–40 วันหลังวันขาย)
                  </label>
                  <input
                    type="date"
                    value={d.terms.firstDue}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.firstDue = e.target.value;
                        autoCalculateTerms(draft.terms, 'firstDue');
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">ประเภทสินค้า</label>
                  <input
                    type="text"
                    placeholder="เช่น โทรศัพท์มือถือ, เครื่องใช้ไฟฟ้า"
                    value={d.terms.productType ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.productType = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">ยี่ห้อ</label>
                  <input
                    type="text"
                    placeholder="เช่น Apple, Samsung"
                    value={d.terms.brand ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.brand = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">รุ่น</label>
                  <input
                    type="text"
                    placeholder="เช่น iPhone 16 Pro"
                    value={d.terms.model ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.model = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">หมายเลขเครื่อง / Serial No.</label>
                  <input
                    type="text"
                    placeholder="เช่น IMEI / Serial"
                    value={d.terms.serial ?? ''}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.terms.serial = e.target.value;
                      })
                    }
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl mono"
                  />
                </div>
              </div>

              {/* Responsible staff */}
              <div className="pt-3 border-t border-slate-100 form-grid-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    กลุ่มเพจ / สื่อที่มา <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={d.pageGroup}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.pageGroup = e.target.value;
                      })
                    }
                    placeholder="เช่น เพจสาขาตัวอย่าง"
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    พนักงานสินเชื่อผู้รับผิดชอบ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={d.financeStaff}
                    onChange={(e) =>
                      updateActiveDraft((draft) => {
                        draft.financeStaff = e.target.value;
                      })
                    }
                    placeholder="ระบุชื่อเจ้าหน้าที่สินเชื่อ"
                    className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Installments Schedule Table */}
            {scheduleRows.length > 0 && (
              <div className="card p-5 bg-white rounded-2xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-2">ตารางงวดผ่อนชำระจำลอง</h3>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                  {scheduleRows.map((r, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 text-xs">
                      <span className="text-slate-600">
                        งวดที่ {i + 1} ·{' '}
                        {r.date.toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <strong className="mono font-bold text-slate-800">฿{money(r.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 5:
        // Step 5: พิกัดติดตาม (GPS)
        return (
          <div className="card p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">พิกัดสถานที่ติดตาม (GPS)</h3>
                <p className="text-xs text-slate-500">
                  ดึงพิกัดจากเครื่องมือถือจริง หรือใช้พิกัดสาธิต
                </p>
              </div>
              <MapPin className="w-6 h-6 text-red-600" />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGetGps}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{gpsLoading ? 'กำลังดึงพิกัด...' : 'ใช้พิกัดจากมือถือจริง'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  updateActiveDraft((draft) => {
                    draft.location.lat = 13.859123;
                    draft.location.lng = 100.521456;
                    draft.location.landmark = 'บ้านเดี่ยวสองชั้น ประตูรั้วสีขาว ติดกับร้านสะดวกซื้อ';
                    draft.location.link = 'https://maps.google.com/?q=13.859123,100.521456';
                  })
                }
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
              >
                ใช้พิกัดสาธิต
              </button>
            </div>

            <div className="form-grid-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ละติจูด (Lat) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={d.location.lat}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.location.lat = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl mono font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ลองจิจูด (Lng) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={d.location.lng}
                  onChange={(e) =>
                    updateActiveDraft((draft) => {
                      draft.location.lng = e.target.value;
                    })
                  }
                  className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl mono font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                จุดสังเกต / วิธีเดินทาง <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                value={d.location.landmark}
                onChange={(e) =>
                  updateActiveDraft((draft) => {
                    draft.location.landmark = e.target.value;
                  })
                }
                placeholder="ระบุจุดสังเกตเด่นชัด เช่น ซอยตรงข้ามวัด ประตูรั้วสีฟ้า"
                className="w-full text-sm p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>
        );

      case 6:
        // Step 6: รูปหลักฐาน (พร้อมกล้องมือถือจริง และ Demo Images)
        const categories: Array<[string, string, number]> = [
          ['id', 'บัตรประชาชนผู้เช่าซื้อ', 1],
          ['buyer', 'ภาพถ่ายคู่ผู้เช่าซื้อ', 1],
          ['place', 'รูปจุดติดตาม GPS (อย่างน้อย 5 รูป)', 5],
          ['delivery', 'ภาพรับสินค้า', 1],
        ];
        if (usesGuarantor(d)) {
          categories.push(['guarantorId', 'บัตรประชาชนผู้ค้ำ', 1], ['guarantor', 'ภาพถ่ายคู่ผู้ค้ำ', 1]);
        }

        return (
          <div className="space-y-4">
            {categories.map(([key, label, requiredCount]) => {
              const currentList = d.photos[key] || [];
              const isFulfilled = currentList.length >= requiredCount;
              return (
                <div key={key} className="card p-4 bg-white rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <strong className="text-sm font-bold text-slate-900 block">{label}</strong>
                      <span className="text-xs text-slate-400">
                        แนบแล้ว {currentList.length} / {requiredCount} รูป
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isFulfilled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {isFulfilled ? 'ครบแล้ว' : 'ยังไม่ครบ'}
                    </span>
                  </div>

                  {/* Upload & Demo Buttons */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => openLiveCamera(key, label)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm active:scale-95"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ถ่ายรูปจากกล้องจริง</span>
                    </button>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>เลือกรูปภาพ</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(key, file);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddDemoPhoto(key, label)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition"
                    >
                      เพิ่มภาพสาธิต
                    </button>
                  </div>

                  {/* Thumbnails Grid */}
                  {currentList.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {currentList.map((photo, pIdx) => (
                        <div
                          key={photo.id || pIdx}
                          className="aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-50 relative group"
                        >
                          <img
                            src={photo.src}
                            alt={photo.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(key, photo.id)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-red-600 text-white flex items-center justify-center text-[10px] opacity-80 sm:opacity-0 group-hover:opacity-100 transition shadow"
                            title="ลบรูปภาพนี้"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );

      case 7:
        return <FinanceAgreementStep />;

      case 8:
        // Step 8: ตรวจความครบถ้วน & ทำขายเปิดสัญญา
        return (
          <div className="space-y-6">
            {/* Callout Notice */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-sm font-bold text-emerald-950 block">
                  ตรวจความพร้อมก่อนส่งทำขาย (One-Click Finish)
                </strong>
                <p className="text-xs text-emerald-800 mt-0.5">
                  เมื่อข้อมูลครบถ้วนทั้ง 2 หมวด เมื่อกดทำขายระบบจะประทับวันขายและเปิดสัญญา (FINISH)
                  ให้ทันทีอัตโนมัติ
                </p>
              </div>
            </div>

            {/* Two-Tier Checklist */}
            <div className="card p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                รายการตรวจสอบข้อมูลความพร้อม (Checklist)
              </h3>
              <div className="space-y-2">
                {checks.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-xs font-semibold text-slate-800">{c.label}</strong>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{c.detail}</p>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-bold text-center self-start ${
                        c.ok
                          ? 'text-emerald-700 bg-emerald-100/90 border border-emerald-200'
                          : 'text-amber-700 bg-amber-100/90 border border-amber-200'
                      }`}
                    >
                      {c.ok ? '✓ ครบถ้วน' : '! ยังขาด'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-36 md:pb-28">
      {/* Top Dossier Bar */}
      <CustomerDossierBar />

      {/* Step Form Content */}
      <div className="mt-4">{renderStepContent()}</div>

      {/* Sticky Bottom Action Footer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2.5 sm:p-3 md:p-4 px-3 sm:px-4 md:px-8 flex items-center justify-between gap-2 sm:gap-3 shadow-sheet safe-bottom">
        <button
          type="button"
          onClick={() => {
            if (canGoPrev) {
              if (stepHistoryRef.current.length > 0) {
                mobileNav.back();
              } else {
                prevStepRef.current = activeStep - 1;
                setActiveStep(activeStep - 1);
              }
            }
          }}
          disabled={!canGoPrev}
          className="shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">ย้อนกลับ</span>
        </button>

        <button
          type="button"
          onClick={saveCurrentDraft}
          className="shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
        >
          <Save className="w-4 h-4 shrink-0 text-slate-500" />
          <span className="whitespace-nowrap">บันทึกร่าง</span>
        </button>
        {activeStep === 8 ? (
          <button
            type="button"
            onClick={() => setConfirmSaleModal(true)}
            className="flex-1 min-w-0 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1 px-2 sm:px-3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] sm:text-xs shadow-md transition"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">ส่งทำขาย & เปิดสัญญา</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => canGoNext && setActiveStep(activeStep + 1)}
            disabled={!canGoNext}
            className="flex-1 min-w-0 shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="whitespace-nowrap">ถัดไป</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        )}
      </div>

      {/* Confirmation Modal for Sale & Auto-Open */}
      {confirmSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">ยืนยันการส่งทำขายสัญญา</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {allOpeningOk
                ? '✓ ข้อมูลเปิดสัญญาครบถ้วนแล้ว ระบบจะส่งทำขายและบันทึกเปิดสัญญา (FINISH) ให้ทันที'
                : 'ข้อมูลเอกสารบางส่วนยังไม่ครบ ระบบจะบันทึกผลขายและรอให้ท่านเปิดสัญญาในภายหลัง'}
            </p>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                วันที่ทำขายสัญญา
              </label>
              <input
                type="date"
                value={saleDateInput}
                onChange={(e) => setSaleDateInput(e.target.value)}
                className="w-full text-sm p-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const ok = submitCurrentDraft();
                  if (ok) {
                    recordSaleCurrentDraft(saleDateInput);
                  }
                  setConfirmSaleModal(false);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                ยืนยันทำขาย
              </button>
              <button
                type="button"
                onClick={() => setConfirmSaleModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
      {/* In-App Camera with Guideline Overlay Modal */}
      {cameraModalConfig?.isOpen && (
        <CameraCaptureModal
          isOpen={cameraModalConfig.isOpen}
          mode={cameraModalConfig.mode}
          title={cameraModalConfig.label}
          onClose={() => setCameraModalConfig(null)}
          onCapture={handleLiveCameraCapture}
        />
      )}
    </div>
  );
};
