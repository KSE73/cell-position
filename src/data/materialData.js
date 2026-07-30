// 2026년 6월 4일 기준 '전해조과_PAT_자재' 엑셀 원본 데이터 (최초 1회 시딩용)
// PART(제조사)별 5개 카테고리(전해조/MEMBRANE/FRAME_GK/HOSE/IN_OUT_GK)의 종류/수량 스냅샷입니다.
// 이후 데이터는 Firestore에서 직접 관리되며, 이 파일은 최초 업로드 시에만 사용됩니다.

export const materialData = {
  "CEC": {
    "전해조": [
      {
        "type": "N-BiTAC",
        "quantity": "총:84(SPARE CELL)\n가:N.-84개.  불:0"
      },
      {
        "type": "Nx-BiTAC",
        "quantity": "Nx-BiTAC SP-112 (양-90 불-22)"
      },
      {
        "type": "E-BiTAC",
        "quantity": "E-BiTAC SP-50"
      }
    ],
    "MEMBRANE": [
      {
        "type": "F-9010",
        "quantity": "483 SH"
      },
      {
        "type": "2030NX\nN-2050\nF-9060",
        "quantity": "0 SH\n62 SH\n0 SH"
      },
      {
        "type": "N-2060",
        "quantity": "0 SH"
      }
    ],
    "FRAME_GK": [
      {
        "type": "ANODE",
        "quantity": "외산-332"
      },
      {
        "type": "CATHODE",
        "quantity": "외산-332"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "quantity": "N-9.\nNX-430"
      },
      {
        "type": "OUT",
        "quantity": "외산:276\n국산:150"
      }
    ],
    "IN_OUT_GK": [
      {
        "type": "OUT(4각)\nEPDM",
        "quantity": "2,800개"
      },
      {
        "type": "국 산",
        "quantity": "910개"
      }
    ]
  },
  "UHDE": {
    "전해조": [
      {
        "type": "ANODE",
        "quantity": "G6+: 39(조립포함) 현가-39. 불-0\nG-6: 166(조립포함)  현가-159 불-6 폐기-1"
      },
      {
        "type": "CATHODE",
        "quantity": "G6+: 39(조립포함) 현가-38. 불-1\nG-6: 166(조립포함)    현가-164   불-2"
      },
      {
        "type": "*조립CELL",
        "quantity": "G6+: 5개 (N-2060)\nG-6: 2개국산전극 (N-2060)"
      }
    ],
    "MEMBRANE": [
      {
        "type": "N-2050WX\nN-2060",
        "quantity": "G-6: 0 SH\nG-6: 368 SH"
      },
      {
        "type": "2030NX",
        "quantity": "G-2: 0 SH\nG-6: 0 SH"
      },
      {
        "type": "F-9060",
        "quantity": "G-6: 0 SH"
      }
    ],
    "FRAME_GK": [
      {
        "type": "G6+",
        "quantity": "94개"
      },
      {
        "type": "G-6",
        "quantity": "118 개"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "quantity": "1500:100"
      },
      {
        "type": "G6+",
        "quantity": 169
      },
      {
        "type": "OUT G-6",
        "quantity": "양:262\n음:대-126 소-64"
      }
    ],
    "IN_OUT_GK": [
      {
        "type": "GORE-\nTEX",
        "quantity": "총: 264롤"
      },
      {
        "type": "1팀 G6+",
        "quantity": "50롤"
      },
      {
        "type": "2팀 G6",
        "quantity": "214롤"
      }
    ]
  },
  "AKCC": {
    "전해조": [
      {
        "type": "BIPOLAR",
        "quantity": "총:186개 ( CA5: 94. CA4: 92. )\n양호:181 (PDT- 포함. SP-)\n수리불가:1 , 폐기:4\n\nCA-6 총 21개 (PDT 포함)\n(음극 수리 1개 , 사용 불가 4개)"
      }
    ],
    "MEMBRANE": [
      {
        "type": "F-7001E\n\nF-9060\nF-7001",
        "quantity": "114 SH (1팀)\n0 SH (2팀)\n3 SH (1팀)\n48 SH (3팀)"
      },
      {
        "type": "N-2050\n\nN-2060",
        "quantity": "1 SH (1팀)\n\n1 SH (1팀)\n85 SH (2팀)"
      }
    ],
    "FRAME_GK": [
      {
        "type": "ANODE",
        "quantity": "※ 599합 : 760 , 925합 : 90\nCA-4  915: 499 , 925: 41\nCA-5  915: 65 , 925: 20\nCA-6  915: 35 ,  925: 29"
      },
      {
        "type": "CATHODE",
        "quantity": "※ 125합 : 593 , 140합 : 44\nCA-4  125: 491 , 140: 20\nCA-5  125: 67 , 140: 9\nCA-6  125: 35 ,  140: 15"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "quantity": "CA-4 : 44\nCA-5 : 43\n 국산 : 119\nCA-6 : 160"
      },
      {
        "type": "OUT",
        "quantity": "CA-4 : 41\n 국산 : 23\nCA-5 : 66\n 국산 : 79\nCA-6 : 160"
      }
    ],
    "IN_OUT_GK": [
      {
        "type": "IN",
        "quantity": "총:4,762개\n(EP : 3,853 TF : 864)\nCA-6 TF : 45"
      },
      {
        "type": "OUT",
        "quantity": "총:4,521개\n(EP : 3,613  TF : 860)\nCA-6 TF : 48"
      }
    ]
  },
  "AGC": {
    "전해조": [
      {
        "type": "ANODE",
        "quantity": "총-7셀(B/L포함) \nNEW: 4 CELL분\nB/L : 2    대기: 4"
      },
      {
        "type": "CATHODE",
        "quantity": "총-6셀(B/L포함)\nNEW: 3 CELL분\nB/L : 2     대기: 4"
      }
    ],
    "MEMBRANE": [
      {
        "type": "F-8080",
        "quantity": "6 CELL"
      },
      {
        "type": "F-795\nN-2030",
        "quantity": ""
      }
    ],
    "FRAME_GK": [
      {
        "type": "ANODE",
        "quantity": "총-6셀(B/L제외)"
      },
      {
        "type": "CATHODE",
        "quantity": "총-6셀(B/L제외)"
      }
    ],
    "HOSE": [
      {
        "type": "IN",
        "quantity": "2개"
      }
    ],
    "IN_OUT_GK": []
  }
};

// 정비 / 반입 / 반출 작업 로그 (자유 텍스트, 원본 엑셀의 줄바꿈 형태를 그대로 보존)
export const materialLogData = {
  "정비": [
    "EL-400 B #47교체 G6+                                                   4/30",
    "CA-5 EL-1500 C 정기교체                                         5/11 ~13",
    "FT915:160 , FT925:5 , SNT125:161 , NG140:2",
    "Out Hose:2 MEMBRANE (2060) : 160",
    "CA-6 EL-2500 A #51 부분교체                                          5/12",
    "In Let O-Ring 3EA , Cell 1EA , Memb' 2EA (F-7001)",
    "CA-5 EL-1500 A #1 부분교체                                            5/12",
    "Cell 1EA , Memb:6장(N2060) , Gasket FT925",
    "CA-5 EL-1500 C #1 부분교체                                            5/14",
    "Cell 1EA , Memb:2장(N2060) ,Out Hose 1EA",
    "CA-5 EL-1500 C #1 부분교체                                      5/15~16",
    "Cell 1EA , Memb:3장(N2060) ,In/Out Hose 각6EA",
    "Spare Gasket 부착 FT915:1 , FT925:2 , SNT125:1 , NG140:2",
    "CA-4 EL-500 E #65 부분교체                                            5/18",
    "Cell 1EA , Memb:4장(F7001E) , Out Let  O-Ring 4EA",
    "CA-4 EL-500 B Out Hose 1EA 교체                                  5/19",
    "AGC E-537 교체 (E-506 + 2회차 , - New 사용)                   5/20"
  ],
  "반입": [
    "UHDE Recoating Pan (158 Set)                                                   6/2"
  ],
  "반출": [
    "AKC 폐전극 반출                                                             5/18"
  ]
};
