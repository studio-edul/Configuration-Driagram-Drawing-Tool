# PptxGenJS ShapeType 참고 자료

이 파일은 PptxGenJS의 TypeScript 타입 정의에서 추출한 ShapeType 정보를 담고 있습니다.
원본: https://github.com/gitbrent/PptxGenJS/tree/master/types/index.d.ts

## 둥근 모서리 사각형 (Rounded Rectangle)

### ShapeType enum
```typescript
export enum ShapeType {
    'roundRect' = 'roundRect',
    // ...
}
```

### shapes enum
```typescript
export enum shapes {
    ROUNDED_RECTANGLE = 'roundRect',
    // ...
}
```

### 사용법
```javascript
// 올바른 사용법
slide.addShape(pres.ShapeType.roundRect, {
    x: 1, y: 1, w: 2, h: 1,
    fill: { color: 'FF0000' },
    rectRadius: 0.25  // 0-1 범위의 비율
});

// 잘못된 사용법 (존재하지 않음)
// pres.ShapeType.ROUNDED_RECTANGLE  ❌
```

### rectRadius 옵션
- **타입**: `number`
- **범위**: `0.0` ~ `1.0`
- **설명**: 둥근 모서리 반경 비율 (사각형 크기에 대한 비율)
- **사용 가능한 ShapeType**: `roundRect`만 지원

### 주요 Rectangle 관련 ShapeType
- `rect`: 일반 사각형
- `roundRect`: 둥근 모서리 사각형 (rectRadius 옵션 사용 가능)
- `round1Rect`: 한 모서리만 둥근 사각형
- `round2DiagRect`: 대각선 두 모서리만 둥근 사각형
- `round2SameRect`: 같은 쪽 두 모서리만 둥근 사각형
- `snip1Rect`: 한 모서리만 잘린 사각형
- `snip2DiagRect`: 대각선 두 모서리만 잘린 사각형
- `snip2SameRect`: 같은 쪽 두 모서리만 잘린 사각형
- `snipRoundRect`: 잘린 모서리와 둥근 모서리가 혼합된 사각형

## 참고
- 전체 ShapeType 목록은 TypeScript 정의 파일 참고: https://github.com/gitbrent/PptxGenJS/tree/master/types/index.d.ts
- 공식 문서: https://gitbrent.github.io/PptxGenJS/docs/api-shapes/



