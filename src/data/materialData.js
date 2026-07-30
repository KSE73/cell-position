// '2026년 6월 전해조 PART별 주요자재 현황' 신규 레이아웃(안) 기준 최초 시딩 데이터
// PART(제조사)별 5개 카테고리(전해조/MEMBRANE/FRAME_GK/HOSE/IN_OUT_GK)의
// 종류(type) / 규격(subType, 있는 경우만) / 단위(unit) 뼈대만 담고 있습니다.
// 수량(quantity)과 비고(note)는 실제 현재값을 앱에서 직접 입력해야 하므로 비워둡니다.
// 이후 데이터는 Firestore에서 직접 관리되며, 이 파일은 최초/재설치 시에만 사용됩니다.

export const materialData = {
  "CEC": {
    "전해조": [
      {
        "type": "N-BiTAC",
        "subType": "",
        "unit": "개"
      },
      {
        "type": "Nx-BiTAC",
        "subType": "",
        "unit": "개"
      },
      {
        "type": "E-BiTAC",
        "subType": "",
        "unit": "개"
      }
    ],
    "MEMBRANE": [
      {
        "type": "F-9010",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "2030NX",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "N-2050",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "F-9060",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "N-2060",
        "subType": "",
        "unit": "SH"
      }
    ],
    "FRAME_GK": [
      {
        "type": "ANODE",
        "subType": "",
        "unit": "개"
      },
      {
        "type": "CATHODE",
        "subType": "",
        "unit": "개"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "subType": "N-BiTAC",
        "unit": "개"
      },
      {
        "type": "IN",
        "subType": "Nx-BiTAC",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "외산",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "국산",
        "unit": "개"
      }
    ],
    "IN_OUT_GK": [
      {
        "type": "OUT(4각)\nEPDM",
        "subType": "",
        "unit": "개"
      },
      {
        "type": "국 산",
        "subType": "",
        "unit": "개"
      }
    ]
  },
  "UHDE": {
    "전해조": [
      {
        "type": "ANODE",
        "subType": "G-6+(조립포함)",
        "unit": "개"
      },
      {
        "type": "ANODE",
        "subType": "G-6(조립포함)",
        "unit": "개"
      },
      {
        "type": "CATHODE",
        "subType": "G-6+(조립포함)",
        "unit": "개"
      },
      {
        "type": "CATHODE",
        "subType": "G-6(조립포함)",
        "unit": "개"
      },
      {
        "type": "*조립CELL",
        "subType": "G-6+(조립포함)",
        "unit": "개"
      },
      {
        "type": "*조립CELL",
        "subType": "G-6(조립포함)",
        "unit": "개"
      }
    ],
    "MEMBRANE": [
      {
        "type": "N-2050WX",
        "subType": "G-2",
        "unit": "SH"
      },
      {
        "type": "N-2050WX",
        "subType": "G-6",
        "unit": "SH"
      },
      {
        "type": "N-2060",
        "subType": "G-2",
        "unit": "SH"
      },
      {
        "type": "N-2060",
        "subType": "G-6",
        "unit": "SH"
      },
      {
        "type": "2030NX",
        "subType": "G-6",
        "unit": "SH"
      },
      {
        "type": "F-9060",
        "subType": "G-6",
        "unit": "SH"
      }
    ],
    "FRAME_GK": [
      {
        "type": "G-6+",
        "subType": "",
        "unit": "개"
      },
      {
        "type": "G-6+",
        "subType": "",
        "unit": "개"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "subType": "",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "G-6+",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "G-6",
        "unit": "개"
      }
    ],
    "IN_OUT_GK": [
      {
        "type": "GORE-TEX",
        "subType": "",
        "unit": "ROLL"
      },
      {
        "type": "CA-2",
        "subType": "G-6+",
        "unit": "ROLL"
      },
      {
        "type": "CA-3",
        "subType": "G-6",
        "unit": "ROLL"
      }
    ]
  },
  "AKCC": {
    "전해조": [
      {
        "type": "BIPOLAR",
        "subType": "CA-4",
        "unit": "개"
      },
      {
        "type": "BIPOLAR",
        "subType": "CA-5",
        "unit": "개"
      },
      {
        "type": "BIPOLAR",
        "subType": "CA-6",
        "unit": "개"
      }
    ],
    "MEMBRANE": [
      {
        "type": "F-7001E",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "F-9060",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "F-7001",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "N-2050",
        "subType": "",
        "unit": "SH"
      },
      {
        "type": "N-2060",
        "subType": "",
        "unit": "SH"
      }
    ],
    "FRAME_GK": [
      {
        "type": "ANODE",
        "subType": "915",
        "unit": "개"
      },
      {
        "type": "ANODE",
        "subType": "925",
        "unit": "개"
      },
      {
        "type": "CATHODE",
        "subType": "125",
        "unit": "개"
      },
      {
        "type": "CATHODE",
        "subType": "140",
        "unit": "개"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "subType": "외산",
        "unit": "개"
      },
      {
        "type": "IN",
        "subType": "국산",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "외산",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "국산",
        "unit": "개"
      }
    ],
    "IN_OUT_GK": [
      {
        "type": "IN",
        "subType": "EP",
        "unit": "개"
      },
      {
        "type": "IN",
        "subType": "TF",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "EP",
        "unit": "개"
      },
      {
        "type": "OUT",
        "subType": "TF",
        "unit": "개"
      }
    ]
  },
  "AGC": {
    "전해조": [
      {
        "type": "ANODE",
        "subType": "",
        "unit": "BL"
      },
      {
        "type": "CATHODE",
        "subType": "",
        "unit": "BL"
      }
    ],
    "MEMBRANE": [
      {
        "type": "F-8080",
        "subType": "",
        "unit": "CELL"
      },
      {
        "type": "F-795",
        "subType": "",
        "unit": "CELL"
      },
      {
        "type": "N-2030",
        "subType": "",
        "unit": "CELL"
      }
    ],
    "FRAME_GK": [
      {
        "type": "ANODE",
        "subType": "",
        "unit": "CELL"
      },
      {
        "type": "CATHODE",
        "subType": "",
        "unit": "CELL"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "subType": "",
        "unit": "개"
      }
    ],
    "IN_OUT_GK": []
  }
};
