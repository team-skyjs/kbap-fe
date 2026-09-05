/**
 * design4Assets — 시안 .fig 원본에서 디코드한 정확 SVG(스펙 bridge/design/4th, 9/5).
 * 형태·치수 무수정(예진 지시 — "형태·치수는 손대지 말 것"), 색은 시안 하드코딩 유지.
 * 소비: AppBar 로고 마크 · SpicePeppers · 쿼터 넛지 일러 · RankMedal.
 * ⚠️ 자동 변환 산출물 — 손편집 금지, 원본 SVG 갱신 시 재생성.
 */
import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

export const AppBarMark = ({ height = 20 }: { height?: number }) => (
  <Svg width={(height * 18.551) / 20} height={height} viewBox="0 0 18.551 20">
      <Path d="M1.37 0C1.37 -0.756 0.756 -1.37 0 -1.37C-0.756 -1.37 -1.37 -0.756 -1.37 0L0 0L1.37 0ZM-1.37 8.406C-1.37 9.162 -0.756 9.775 0 9.775C0.756 9.775 1.37 9.162 1.37 8.406L0 8.406L-1.37 8.406ZM0 0L-1.37 0L-1.37 8.406L0 8.406L1.37 8.406L1.37 0L0 0Z" fill="#ff7134" transform="matrix(1,0,0,1,5.797,0)" />
      <Path d="M5.834 1.027C6.401 0.527 6.455 -0.339 5.955 -0.906C5.454 -1.473 4.589 -1.528 4.021 -1.027L4.928 0L5.834 1.027ZM0 4.348L-0.906 3.321C-1.212 3.591 -1.382 3.983 -1.369 4.39C-1.356 4.798 -1.163 5.179 -0.841 5.429L0 4.348ZM4.376 9.487C4.974 9.951 5.834 9.844 6.299 9.247C6.763 8.65 6.655 7.789 6.058 7.325L5.217 8.406L4.376 9.487ZM4.928 0L4.021 -1.027L-0.906 3.321L0 4.348L0.906 5.375L5.834 1.027L4.928 0ZM0 4.348L-0.841 5.429L4.376 9.487L5.217 8.406L6.058 7.325L0.841 3.267L0 4.348Z" fill="#ff7134" transform="matrix(1,0,0,1,7.826,0)" />
      <Path d="M0 0L18.551 0C18.551 2.46 17.573 4.819 15.834 6.559C14.094 8.298 11.735 9.275 9.275 9.275C6.815 9.275 4.456 8.298 2.717 6.559C0.977 4.819 0 2.46 0 0Z" fill="#ff7134" fillRule="nonzero" transform="matrix(1,0,0,1,0,10.725)" />
  </Svg>
);

export const PepperOn = ({ height = 16 }: { height?: number }) => (
  <Svg width={(height * 16) / 16} height={height} viewBox="0 0 16 16">
      <Path d="M5.873 2.937C5.873 1.315 4.558 0 2.937 0C1.315 0 0 1.315 0 2.937L5.873 2.937Z" fill="#037f56" fillRule="nonzero" transform="matrix(1,0,0,1,8.127,2.39)" />
      <Path d="M11.021 0C10.48 0 10.042 0.438 10.042 0.979C10.042 0.438 9.604 0 9.063 0C8.522 0 8.084 0.438 8.084 0.979C8.084 0.438 7.646 0 7.105 0C6.565 0 6.126 0.438 6.126 0.979L6.128 0.979C6.128 5.027 3.692 8.507 0.206 10.032C-0.102 10.166 -0.053 10.62 0.276 10.683C0.875 10.796 1.492 10.855 2.123 10.855C7.578 10.855 11.999 6.433 11.999 0.979C11.999 0.438 11.561 0 11.021 0Z" fill="#e32939" fillRule="nonzero" transform="matrix(1,0,0,1,2,4.35)" />
      <Path d="M1.377 1.754C1.168 1.754 0.999 1.585 0.999 1.377C0.999 1.034 0.72 0.755 0.377 0.755C0.169 0.755 0 0.586 0 0.377C0 0.169 0.169 0 0.377 0C1.137 0 1.755 0.617 1.755 1.377C1.755 1.586 1.586 1.755 1.377 1.755L1.377 1.754Z" fill="#037f56" fillRule="nonzero" transform="matrix(1,0,0,1,9.686,1.002)" />
  </Svg>
);

export const PepperOff = ({ height = 16 }: { height?: number }) => (
  <Svg width={(height * 16) / 16} height={height} viewBox="0 0 16 16">
      <Path d="M5.873 2.937C5.873 1.315 4.558 0 2.937 0C1.315 0 0 1.315 0 2.937L5.873 2.937Z" fill="#9196a1" fillRule="nonzero" transform="matrix(1,0,0,1,8.127,2.389)" />
      <Path d="M11.021 0C10.48 0 10.042 0.438 10.042 0.979C10.042 0.438 9.604 0 9.063 0C8.523 0 8.084 0.438 8.084 0.979C8.084 0.438 7.646 0 7.105 0C6.565 0 6.127 0.438 6.127 0.979L6.128 0.979C6.128 5.027 3.692 8.507 0.206 10.032C-0.102 10.167 -0.053 10.621 0.276 10.683C0.875 10.796 1.492 10.856 2.123 10.856C7.578 10.856 11.999 6.434 11.999 0.979C11.999 0.438 11.562 0 11.021 0Z" fill="#d1d3d8" fillRule="nonzero" transform="matrix(1,0,0,1,2,4.349)" />
      <Path d="M1.377 1.754C1.168 1.754 0.999 1.585 0.999 1.377C0.999 1.034 0.72 0.755 0.377 0.755C0.169 0.755 0 0.586 0 0.377C0 0.169 0.169 0 0.377 0C1.137 0 1.755 0.618 1.755 1.377C1.755 1.586 1.586 1.755 1.377 1.755L1.377 1.754Z" fill="#9196a1" fillRule="nonzero" transform="matrix(1,0,0,1,9.687,1.001)" />
  </Svg>
);

export const IlloSpeechBubble = ({ height = 40 }: { height?: number }) => (
  <Svg width={(height * 40) / 40} height={height} viewBox="0 0 40 40">
      <Path d="M17.5 0C7.835 0 0 7.014 0 15.666C0 19.12 1.259 22.305 3.378 24.893C4.154 25.841 4.509 27.064 4.275 28.266L3.32 33.163C3.16 33.985 4.02 34.628 4.763 34.241L10.576 31.215C11.397 30.788 12.342 30.649 13.245 30.854C14.607 31.163 16.031 31.332 17.5 31.332C27.165 31.332 35 24.318 35 15.666C35 7.014 27.165 0 17.5 0Z" fill="#fbeec4" fillRule="nonzero" transform="matrix(1,0,0,1,2.5,2.822)" />
      <Path d="M1.959 0C3.041 0 3.917 0.877 3.917 1.958C3.917 2.477 3.711 2.975 3.343 3.343C2.976 3.71 2.478 3.917 1.958 3.917C0.876 3.917 0 3.04 0 1.959C0 0.878 0.877 0.001 1.958 0.001L1.959 0Z" fill="#4b3933" fillRule="nonzero" transform="matrix(1,0,0,1,10.795,17.03)" />
      <Path d="M1.958 3.916C3.039 3.916 3.916 3.039 3.916 1.958C3.916 0.877 3.039 0 1.958 0C0.877 0 0 0.877 0 1.958C0 3.039 0.877 3.916 1.958 3.916Z" fill="#4b3933" fillRule="nonzero" transform="matrix(1,0,0,1,25.288,17.03)" />
      <Path d="M1.958 3.916C3.039 3.916 3.916 3.039 3.916 1.958C3.916 0.877 3.039 0 1.958 0C0.877 0 0 0.877 0 1.958C0 3.039 0.877 3.916 1.958 3.916Z" fill="#4b3933" fillRule="nonzero" transform="matrix(1,0,0,1,18.042,17.03)" />
  </Svg>
);

export const Medal1 = ({ height = 35 }: { height?: number }) => (
  <Svg width={(height * 28) / 35} height={height} viewBox="0 0 28 35">
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#ffc700" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a68100" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M8.293 0C11.397 0 14.265 1.011 16.586 2.721L8.752 6.764C8.464 6.912 8.122 6.912 7.834 6.764L0 2.721C2.321 1.011 5.189 0 8.293 0Z" fill="#8c6d00" fillRule="nonzero" transform="matrix(1,0,0,1,5.707,7)" />
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#ffc700" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a68100" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(1,0,0,1,6,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(-1,0,0,1,22,0)" />
  </Svg>
);

export const Medal2 = ({ height = 35 }: { height?: number }) => (
  <Svg width={(height * 28) / 35} height={height} viewBox="0 0 28 35">
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#ff6a3c" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a64527" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M8.293 0C11.397 0 14.265 1.011 16.586 2.721L8.752 6.764C8.464 6.912 8.122 6.912 7.834 6.764L0 2.721C2.321 1.011 5.189 0 8.293 0Z" fill="#8c3a21" fillRule="nonzero" transform="matrix(1,0,0,1,5.707,7)" />
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#ff6a3c" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a64527" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(1,0,0,1,6,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(-1,0,0,1,22,0)" />
  </Svg>
);

export const Medal3 = ({ height = 35 }: { height?: number }) => (
  <Svg width={(height * 28) / 35} height={height} viewBox="0 0 28 35">
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#26de81" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#199054" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M8.293 0C11.397 0 14.265 1.011 16.586 2.721L8.752 6.764C8.464 6.912 8.122 6.912 7.834 6.764L0 2.721C2.321 1.011 5.189 0 8.293 0Z" fill="#157a47" fillRule="nonzero" transform="matrix(1,0,0,1,5.707,7)" />
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#26de81" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#199054" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(1,0,0,1,6,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(-1,0,0,1,22,0)" />
  </Svg>
);

export const Medal4 = ({ height = 35 }: { height?: number }) => (
  <Svg width={(height * 28) / 35} height={height} viewBox="0 0 28 35">
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#45aaf2" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#2d6f9d" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M8.293 0C11.397 0 14.265 1.011 16.586 2.721L8.752 6.764C8.464 6.912 8.122 6.912 7.834 6.764L0 2.721C2.321 1.011 5.189 0 8.293 0Z" fill="#265e85" fillRule="nonzero" transform="matrix(1,0,0,1,5.707,7)" />
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#45aaf2" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#2d6f9d" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(1,0,0,1,6,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(-1,0,0,1,22,0)" />
  </Svg>
);

export const Medal5 = ({ height = 35 }: { height?: number }) => (
  <Svg width={(height * 28) / 35} height={height} viewBox="0 0 28 35">
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#a55eea" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#6b3d98" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M8.293 0C11.397 0 14.265 1.011 16.586 2.721L8.752 6.764C8.464 6.912 8.122 6.912 7.834 6.764L0 2.721C2.321 1.011 5.189 0 8.293 0Z" fill="#5b3481" fillRule="nonzero" transform="matrix(1,0,0,1,5.707,7)" />
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#a55eea" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#6b3d98" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(1,0,0,1,6,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(-1,0,0,1,22,0)" />
  </Svg>
);

export const Medal6 = ({ height = 35 }: { height?: number }) => (
  <Svg width={(height * 28) / 35} height={height} viewBox="0 0 28 35">
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#fc5c65" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a43c42" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M8.293 0C11.397 0 14.265 1.011 16.586 2.721L8.752 6.764C8.464 6.912 8.122 6.912 7.834 6.764L0 2.721C2.321 1.011 5.189 0 8.293 0Z" fill="#8b3338" fillRule="nonzero" transform="matrix(1,0,0,1,5.707,7)" />
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#fc5c65" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a43c42" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(1,0,0,1,6,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(-1,0,0,1,22,0)" />
  </Svg>
);

export const Medal7 = ({ height = 35 }: { height?: number }) => (
  <Svg width={(height * 28) / 35} height={height} viewBox="0 0 28 35">
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#fd79a8" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a44f6d" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M8.293 0C11.397 0 14.265 1.011 16.586 2.721L8.752 6.764C8.464 6.912 8.122 6.912 7.834 6.764L0 2.721C2.321 1.011 5.189 0 8.293 0Z" fill="#8b435c" fillRule="nonzero" transform="matrix(1,0,0,1,5.707,7)" />
      <Path d="M28 14C28 21.732 21.732 28 14 28C6.268 28 0 21.732 0 14C0 6.268 6.268 0 14 0C21.732 0 28 6.268 28 14Z" fill="#fd79a8" fillRule="nonzero" transform="matrix(1,0,0,1,0,7)" />
      <Path d="M0 1C0 0.448 0.448 0 1 0L21 0C21.552 0 22 0.448 22 1L22 7.715C22 8.089 21.791 8.432 21.459 8.604L11.459 13.763C11.171 13.912 10.829 13.912 10.541 13.763L0.541 8.604C0.209 8.432 0 8.089 0 7.715L0 1Z" fill="#a44f6d" fillRule="nonzero" transform="matrix(1,0,0,1,3,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(1,0,0,1,6,0)" />
      <Path d="M0 10L0 0L3 0L3 11.5L0 10Z" fill="#ffffff" fillRule="nonzero" transform="matrix(-1,0,0,1,22,0)" />
  </Svg>
);

