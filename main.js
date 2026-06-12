// 1. 初期設定
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3, 10);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.target.set(0, 2, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// 2. テクスチャ生成
function createEyeTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#000000';
    if(type === 'anime01') {
        ctx.beginPath(); ctx.ellipse(64, 64, 20, 35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(192, 64, 20, 35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(64, 45, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(192, 45, 8, 0, Math.PI * 2); ctx.fill();
    } else if(type === 'anime02') {
        ctx.fillRect(40, 40, 48, 20); ctx.fillRect(168, 40, 48, 20);
    } else if(type === 'anime03') {
        ctx.lineWidth = 8; ctx.strokeStyle = '#000';
        ctx.beginPath(); ctx.arc(64, 70, 25, Math.PI, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(192, 70, 25, Math.PI, Math.PI*2); ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
}

function createMouthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(64, 10, 20, 0, Math.PI); ctx.stroke();
    return new THREE.CanvasTexture(canvas);
}

// 3. キャラクター生成
let characterGroup = null;
let animatedParts = {};
// ★ 修正：初期データに earType: "human" を追加
let characterData = { headScaleY: 1.1, headScaleX: 1.0, jawWidth: 0.8, eyeType: "anime01", hairType: "short01", bodyColor: "#ffe0c0", bustSize: 0.5, earType: "human", bustProtrude: 0.33, shirtColor: "#ffffff", pantsColor: "none", bootsColor: "none" };

function createCharacter(data) {
    if (characterGroup) scene.remove(characterGroup);
    characterGroup = new THREE.Group();
    animatedParts = { arms: [], legs: [] };

    // ★ 位置変更：おにぎり型（卵型）を作る共通関数を、頭や耳の処理でも使えるように上に移動しました
    function createEggGeo(scaleX, scaleY, scaleZ, taperY) {
        const geo = new THREE.SphereGeometry(1, 32, 32);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            let x = p.getX(i); let y = p.getY(i); let z = p.getZ(i);
            let taper = 1.0 - (y * taperY); 
            p.setX(i, x * scaleX * taper);
            p.setY(i, y * scaleY);
            p.setZ(i, z * scaleZ); 
        }
        geo.computeVertexNormals();
        return geo;
    }

    const skinMat = new THREE.MeshLambertMaterial({ color: data.bodyColor });
    const clothesMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    // --- 頭 ---
    const headGeo = new THREE.SphereGeometry(1, 32, 32);
    const pos = headGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        if (y < 0) {
            let factor = 1.0 - (Math.abs(y) * (1.0 - data.jawWidth));
            pos.setX(i, pos.getX(i) * factor); 
            pos.setZ(i, pos.getZ(i) * factor + Math.abs(y) * 0.12); 
        }
    }
    headGeo.computeVertexNormals();
    const head = new THREE.Mesh(headGeo, skinMat);
    head.scale.set(data.headScaleX, data.headScaleY, data.headScaleX);
    // 頭の下端を固定（y≈2.95）して上方向にのみ伸ばす
    // center.y = 下端 + 半径(≈0.7) * scaleY
    const headBaseY = 2.87; // 頭側球体中心(2.87)＝頭が半分埋まる
    const headRadius = 0.70;
    head.position.set(0, headBaseY + headRadius * data.headScaleY, 0.15);
    head.rotation.x = 0.05; 
    animatedParts.head = head;

    const eyeMat = new THREE.MeshBasicMaterial({ map: createEyeTexture(data.eyeType), transparent: true });
    const eyes = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), eyeMat);
    eyes.position.set(0, -0.05, 1.02); head.add(eyes);

    const mouthMat = new THREE.MeshBasicMaterial({ map: createMouthTexture(), transparent: true });
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), mouthMat);
    mouth.position.set(0, -0.45, 0.98); head.add(mouth);

    // ★ 追加箇所：耳の生成ロジック
    if (data.earType === 'human' || data.earType === 'elf') {
        let earGeo;
        if (data.earType === 'human') {
            // 人間の耳：少しふっくらしたおにぎり型
            earGeo = createEggGeo(0.14, 0.24, 0.16, 0.3);
        } else {
            // エルフの耳：縦に長く、上がツンと尖ったおにぎり型
            earGeo = createEggGeo(0.14, 0.55, 0.14, 0.65);
        }

        // 左耳 (キャラの左・向かって右)
        const earL = new THREE.Mesh(earGeo, skinMat);
        if (data.earType === 'human') {
            earL.position.set(0.92, -0.1, -0.05);
            earL.rotation.set(0.1, -0.2, -0.2); // ほんのり前傾
        } else {
            earL.position.set(0.92, 0.05, -0.15);
            earL.rotation.set(-0.15, -0.4, -0.6); // 外側・後ろに流すように尖らせる
        }
        head.add(earL);

        // 右耳 (キャラの右・向かって左)
        const earR = new THREE.Mesh(earGeo, skinMat);
        if (data.earType === 'human') {
            earR.position.set(-0.92, -0.1, -0.05);
            earR.rotation.set(0.1, 0.2, 0.2);
        } else {
            earR.position.set(-0.92, 0.05, -0.15);
            earR.rotation.set(-0.15, 0.4, 0.6);
        }
        head.add(earR);
    }

    // --- 髪の毛 ---
    const hairGroup = new THREE.Group();
    hairGroup.add(new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 32, 0, Math.PI * 2, 0, Math.PI / 1.95), hairMat));
    
    if (data.hairType === 'short01') {
        const sideGeo = new THREE.ConeGeometry(0.25, 0.8, 16);
        const sideL = new THREE.Mesh(sideGeo, hairMat); sideL.position.set(0.95, -0.4, 0.1); sideL.rotation.z = -0.3;
        const sideR = new THREE.Mesh(sideGeo, hairMat); sideR.position.set(-0.95, -0.4, 0.1); sideR.rotation.z = 0.3;
        hairGroup.add(sideL, sideR);
    } else if (data.hairType === 'long01') {
        const backHairGeo = new THREE.CylinderGeometry(1.05, 0.95, 3.2, 32);
        backHairGeo.translate(0, -1.6, 0); 
        const backHair = new THREE.Mesh(backHairGeo, hairMat);
        backHair.position.set(0, 0.2, -0.45); 
        backHair.rotation.x = 0.12;           
        backHair.scale.z = 0.55;              
        hairGroup.add(backHair);

        const hairJoint = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 32), hairMat);
        hairJoint.position.set(0, 0.2, -0.45); 
        hairJoint.scale.z = 0.55;              
        hairGroup.add(hairJoint);
    }
    head.add(hairGroup); characterGroup.add(head);

    // 首：胸側球体 + 円筒 + 頭側球体 の3パーツ構成
    // 半径r=0.27、円筒長さ=直径=0.54
    // 配置: 胸上端(chest y=2.0, chestR≈0.42)に胸側球体を接続
    //   胸側球体中心 y = 2.42
    //   円筒中心     y = 2.42 + 0.27 + 0.27 = 2.96 → (2.42+0.27) + 0.27 = 2.96
    //   頭側球体中心 y = 2.42 + 0.54 + 0.54 = 3.50
    const neckR = 0.27;
    const neckCylLen = neckR * 2 / 3; // 0.18（円筒部分の長さ）

    const neckGroup = new THREE.Group();
    neckGroup.position.set(0, 0, 0.03);
    characterGroup.add(neckGroup);

    // 円筒の下端y・上端y
    const neckCylBottom = 2.42 + neckR; // 胸側半球の中心と同じ高さ
    const neckCylTop    = neckCylBottom + neckCylLen;

    // 胸側半球：円筒下端に中心を合わせ → 下半分が胸部に埋まり、上半分が円筒端を閉じる
    const neckBottomGeo = new THREE.SphereGeometry(neckR, 16, 8);
    const neckBottom = new THREE.Mesh(neckBottomGeo, skinMat);
    neckBottom.position.set(0, neckCylBottom, 0);
    neckGroup.add(neckBottom);

    // 円筒本体
    const neckCylGeo = new THREE.CylinderGeometry(neckR, neckR, neckCylLen, 16, 1, true); // openEnded
    const neckCyl = new THREE.Mesh(neckCylGeo, skinMat);
    neckCyl.position.set(0, neckCylBottom + neckCylLen * 0.5, 0);
    neckGroup.add(neckCyl);

    // 頭側半球：円筒上端に中心を合わせ → 上半分が頭部に埋まり、下半分が円筒端を閉じる
    const neckTopGeo = new THREE.SphereGeometry(neckR, 16, 8);
    const neckTop = new THREE.Mesh(neckTopGeo, skinMat);
    neckTop.position.set(0, neckCylTop, 0);
    neckGroup.add(neckTop);

    animatedParts.neck = neckGroup;

    // --- 胴体 ---
    // 臀部：胸部と同じ形状・サイズ
    const pelvisGeo = new THREE.SphereGeometry(0.52, 20, 16);
    const pelvis = new THREE.Mesh(pelvisGeo, skinMat);
    pelvis.scale.set(1.15, 0.80, 0.72); // 胸部と同じ楕円球
    pelvis.position.y = 1.1; 
    characterGroup.add(pelvis);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), skinMat); 
    belly.scale.set(1.0, 1.0, 0.72); // 前後を薄くして背中から飛び出さないように
    belly.position.y = 1.5; 
    animatedParts.belly = belly;
    characterGroup.add(belly);

    // chest: 前後につぶれた楕円球（X広め・Y中・Z薄め）
    const chestGeo = new THREE.SphereGeometry(0.52, 20, 16);
    const chest = new THREE.Mesh(chestGeo, skinMat);
    chest.scale.set(1.15, 0.80, 0.72); // 横広・前後薄の楕円球
    chest.position.y = 2.0; 
    animatedParts.chest = chest;
    characterGroup.add(chest);

    // --- 服グループ ---
    // clothesGroupはbodyGroupと完全に分離した独立グループ
    // 将来「鎧」「ローブ」等への拡張もここに追加するだけでOK
    // ズボンを先に追加し、シャツを後から上に重ねる
    if (data.pantsColor && data.pantsColor !== 'none') {
        const pg = createPants(data.pantsColor, characterGroup, data);
        pg.renderOrder = 1;
    }
    if (data.shirtColor && data.shirtColor !== 'none') {
        const sg = createTShirt(data.shirtColor, characterGroup, data);
        if (sg) sg.renderOrder = 2;
    }

    // 胸の大きさ（バスト）の表現
    if (data.bustSize > 0) {
        const b = data.bustSize;
        const bustRadius = 0.22 * b; // 胸球体の半径
        // 飛び出し量の上限 = 半径の2/3（それ以上は球体が露出して不自然）
        const pRaw = data.bustProtrude;
        const pMax = bustRadius; // 最大=半球（球体の半径分だけ前に出る）
        const p = Math.min(pRaw, pMax);
        const bustGeo = new THREE.SphereGeometry(bustRadius, 16, 16); // 完全な球体

        // 左胸
        const bustL = new THREE.Mesh(bustGeo, skinMat);
        bustL.position.set(0.17, -0.05, p); 
        bustL.rotation.x = Math.PI / 2.2;     
        bustL.rotation.y = -0.15;             
        bustL.rotation.z = -0.2;              
        chest.add(bustL);

        // 右胸
        const bustR = new THREE.Mesh(bustGeo, skinMat);
        bustR.position.set(-0.17, -0.05, p); 
        bustR.rotation.x = Math.PI / 2.2;
        bustR.rotation.y = 0.15;              
        bustR.rotation.z = 0.2;               
        chest.add(bustR);
    }

    // --- 関節ジオメトリ ---
    const bigJointGeo = new THREE.SphereGeometry(0.2, 16, 16); 
    const smallJointGeo = new THREE.SphereGeometry(0.16, 16, 16); 

    // ★ 修正：腕用と脚用でジオメトリを別々に生成する
    // translate()はジオメトリ自体を書き換える破壊的操作のため、共有すると2つ目がずれるバグがあった
    function createLimbGeo() {
        const geo = new THREE.CylinderGeometry(0.16, 0.13, 0.8, 16);
        geo.translate(0, -0.4, 0);
        return geo;
    }

    function createArm(xPos) {
        const shoulder = new THREE.Mesh(bigJointGeo, skinMat); 
        shoulder.position.set(xPos, 2.15, 0); // 肩を下げてなで肩に
        const upperArm = new THREE.Mesh(createLimbGeo(), skinMat); 
        shoulder.add(upperArm);
        const elbow = new THREE.Mesh(smallJointGeo, skinMat); 
        elbow.position.set(0, -0.8, 0);
        upperArm.add(elbow);
        const foreArm = new THREE.Mesh(createLimbGeo(), skinMat); 
        elbow.add(foreArm);
        const wrist = new THREE.Mesh(smallJointGeo, skinMat); 
        wrist.position.set(0, -0.8, 0);
        foreArm.add(wrist);
        characterGroup.add(shoulder);
        return { root: shoulder, joint: elbow };
    }

    function createLeg(xPos, pelvisMesh) {
        // 股関節：臀部の45% = 0.27
        // pelvisの子にして表面内側(z=+0.25)に収める → 飛び出し防止
        // pelvis横半径 = 0.52*1.15 ≈ 0.598
        // 股関節半径 = 0.22（臀部横半径の約37%、見た目で適切なサイズ）
        // xPos = ±0.26（臀部内に収まる位置）
        const hipR = 0.22;
        const hipGeo = new THREE.SphereGeometry(hipR, 16, 16);
        const hip = new THREE.Mesh(hipGeo, skinMat);
        // pelvisの子から外してcharacterGroup直下に
        // 臀部下端y≈0.68の少し下、見える位置に配置
        hip.position.set(xPos, 0.54, 0.0); // 臀部下端にくっつく位置

        // 膝関節：股関節と同じサイズ
        const kneeR = 0.15; // ズボン脚円筒(X=0.26)に収まるサイズ
        const kneeGeo = new THREE.SphereGeometry(kneeR, 16, 16);
        const knee = new THREE.Mesh(kneeGeo, skinMat);
        knee.position.set(0, -0.85, 0);
        hip.add(knee);

        // 太もも：上(股関節側)が太く、下(膝側)が細くなる円錐台
        // radiusTop > radiusBottom になるよう hipR基準で上を大きく取る
        const thighLen = 0.85;
        const thighTopR  = hipR * 1.1;   // 上端：股関節に合わせて太く  ≈ 0.30
        const thighBotR  = kneeR * 0.75; // 下端：膝関節より細く        ≈ 0.24
        const thighGeo = new THREE.CylinderGeometry(thighTopR, thighBotR, thighLen, 16);
        thighGeo.translate(0, -thighLen / 2, 0);
        const thigh = new THREE.Mesh(thighGeo, skinMat);
        hip.add(thigh);

        // ふくらはぎ：上(膝側)が太く、下(足首側)が細くなる円錐台
        const calfLen = 0.85;
        const calfTopR  = kneeR * 0.85; // 上端：膝関節に接続  ≈ 0.27
        const calfBotR  = 0.13;         // 下端：足首へ向けて細く
        const calfGeo = new THREE.CylinderGeometry(calfTopR, calfBotR, calfLen, 16);
        calfGeo.translate(0, -calfLen / 2, 0);
        const calf = new THREE.Mesh(calfGeo, skinMat);
        knee.add(calf);

        // ── 足首（関節球体） ──
        const ankleR = 0.14;
        const ankle = new THREE.Mesh(new THREE.SphereGeometry(ankleR, 16, 16), skinMat);
        ankle.position.set(0, -calfLen, 0);
        knee.add(ankle);

        // ── 足 ──
        // 構造：足首は足の「後ろ上」に位置する
        //   足首(球体)
        //       ↘ 斜め前下
        //   [かかと]〜〜〜〜〜[指先]
        //    後(+Z)             前(-Z)
        //
        // footグループの原点=足の平の「かかと上端」
        // → 足首から見て「前下(-Z, -Y方向)」にfootを置く
        const foot = new THREE.Group();
        // 足首中心から: 前方(-Z)へ0.18、下(-Y)へ0.10
        foot.position.set(0, -0.10, +0.18); // 足首から後方(+Z=かかと側)へ
        ankle.add(foot);

        // 【土台】扁平球体で「丸みある三角形の足の平」
        // footの原点=かかと付近、指先は+Z方向(前)へ伸びる
        const soleSphere = new THREE.SphereGeometry(0.20, 20, 14);
        const sole = new THREE.Mesh(soleSphere, skinMat);
        sole.scale.set(
            0.95,  // X: 足幅
            0.35,  // Y: 薄く扁平
            1.6    // Z: 前後に長く
        );
        // 指先(+Z)側が長くなるよう+Z寄りにオフセット
        sole.position.set(0, 0, +0.08);
        foot.add(sole);

        // 【甲の盛り上がり】
        // 足首側(かかと寄り)が高く、指先に向かって低くなる自然な甲の形
        // 球体を前後に長く・縦に潰して、前傾きをつける
        const instepGeo = new THREE.SphereGeometry(0.18, 16, 12);
        const instep = new THREE.Mesh(instepGeo, skinMat);
        instep.scale.set(
            0.80,  // X: 足幅より少し細く
            0.65,  // Y: 高さ（土台より立体的に）
            1.55   // Z: 前後に長く（足の平全体をカバー）
        );
        // 土台中央よりやや高め・かかと寄りに配置
        instep.position.set(0, 0.08, +0.04);
        // 指先に向かって低くなるよう前傾き
        instep.rotation.x = 0.25;
        foot.add(instep);

        pelvisMesh.parent ? pelvisMesh.parent.add(hip) : characterGroup.add(hip);
        return { root: hip, joint: knee };
    }

    animatedParts.arms.push(createArm(0.65));  
    animatedParts.arms.push(createArm(-0.65)); 
    animatedParts.legs.push(createLeg(0.378, pelvis)); 
    animatedParts.legs.push(createLeg(-0.378, pelvis)); 

    // 長靴：脚(ankle)生成後に追加
    if (data.bootsColor && data.bootsColor !== 'none') {
        createBoots(data.bootsColor, characterGroup);
    }

    scene.add(characterGroup);
}

createCharacter(characterData);

// ============================================================
// createTShirt() — 服生成関数
// ============================================================
// 【設計方針】
//   ・body（素体）と完全分離。新しいMesh/Geometry/Materialで構成
//   ・clothesGroup を characterGroup の子として追加
//   ・胴体：頂点変形で胸部を前方に押し出し自然な膨らみを表現
//   ・袖：左右別Meshで肩関節の子にする（腕回転に追従）
//   ・将来「鎧」「ローブ」等を追加するときはこの関数を参考に
// ============================================================
function createTShirt(color, targetGroup, data) {

    // ── マテリアル ──────────────────────────────────────────
    const shirtMat = new THREE.MeshLambertMaterial({
        color: color,
        side: THREE.DoubleSide,
    });

    // ── clothesGroup：服全体をまとめるグループ ──────────────
    const clothesGroup = new THREE.Group();
    clothesGroup.name = 'clothesGroup';

    // ============================================================
    // 【胴体 上部】半楕円ドーム＋首穴
    // 設計図①: 胸部楕円の上側を微増した半楕円スキン
    // 設計図②: 中央に首球体半径(neckR=0.27)の穴
    // ============================================================
    // chest上端y≈2.42、ドーム半径≈0.68（肩をカバー）
    const domeY    = 2.10;  // ドーム底面（首が見えるよう下げる）
    const domeR    = 0.68;  // 横半径（肩をカバー）
    const domeH    = 0.38;  // ドームの高さ（半楕円）
    const neckHole = 0.30;  // 首穴半径（neckR=0.27より少し大きめ）
    const segments = 32;

    // SphereGeometryの上半分を使ってドームを作る
    // phiStart=0, phiLength=π → 上半球
    // 首穴：thetaStart=arcsin(neckHole/domeR)で中央を開ける
    const domeGeo = new THREE.SphereGeometry(
        domeR,      // radius
        segments,   // widthSegments
        16,         // heightSegments
        0,          // phiStart
        Math.PI * 2,// phiLength（全周）
        Math.asin(neckHole / domeR), // thetaStart：首穴の角度から始める
        Math.PI / 2 // thetaLength：上半球のみ
    );
    // Y方向をdomeH/domeRで圧縮して半楕円に
    // Z方向を0.72倍で前後を薄く
    const domePos = domeGeo.attributes.position;
    for (let i = 0; i < domePos.count; i++) {
        domePos.setY(i, domePos.getY(i) * (domeH / domeR));
        domePos.setZ(i, domePos.getZ(i) * 0.72);
    }
    domePos.needsUpdate = true;
    domeGeo.computeVertexNormals();

    const dome = new THREE.Mesh(domeGeo, shirtMat);
    dome.name = 'shirtDome';
    dome.position.y = domeY;
    clothesGroup.add(dome);

    // 首穴の縁取り（TorusGeometry）
    const collarGeo = new THREE.TorusGeometry(neckHole, 0.035, 8, 32);
    const collar = new THREE.Mesh(collarGeo, shirtMat);
    collar.name = 'shirtCollar';
    collar.rotation.x = Math.PI / 2; // 水平に寝かせる
    collar.position.y = domeY + domeH * 0.95;
    clothesGroup.add(collar);

    // ============================================================
    // 【胴体 下部】ドーム底面(y=domeY)から股下(y=0.65)まで円錐台
    // 設計図③: 楕円端から股下まで円錐台を伸ばす
    // ============================================================
    const skirtH   = domeY - 0.65;  // ≈1.77
    const skirtGeo = new THREE.CylinderGeometry(
        domeR,        // radiusTop: ドーム底面と同じ半径
        domeR * 0.92, // radiusBottom: 裾は少し絞る
        skirtH,
        segments,
        1,
        true  // openEnded
    );
    // Z方向を0.72倍にして楕円断面
    const skirtPos = skirtGeo.attributes.position;
    for (let i = 0; i < skirtPos.count; i++) {
        skirtPos.setZ(i, skirtPos.getZ(i) * 0.72);
    }
    skirtPos.needsUpdate = true;
    skirtGeo.computeVertexNormals();

    const skirt = new THREE.Mesh(skirtGeo, shirtMat);
    skirt.name = 'shirtSkirt';
    skirt.position.y = domeY - skirtH / 2;
    clothesGroup.add(skirt);

    // ============================================================
    // 【胸カバー】bustSize連動で胸球体を服色で覆う
    // ① 左右の胸の間を埋める円柱（谷間カバー）
    // ② 左右それぞれ外側を服色球体で覆う
    // chest(y=2.0)の子 bustL/R の位置に合わせる
    // bustL: position(+0.26, 0.15, p), bustR: position(-0.26, 0.15, p)
    // ============================================================
    if (data.bustSize > 0) {
        const b   = data.bustSize;
        const p   = data.bustProtrude;
        const br  = 0.22 * b;       // 胸球体の半径
        const cr  = br * 1.08;      // カバー半径（胸より少し大き目）

        // chestメッシュを探す（y≈2.0）
        let chestMesh = null;
        targetGroup.traverse(obj => {
            if (obj.isMesh && Math.abs(obj.position.y - 2.0) < 0.05
                && !obj.name.startsWith('shirt')) {
                chestMesh = obj;
            }
        });

        if (chestMesh) {
            // ① 谷間円柱：左右胸中心(x=±0.26)の間を埋める
            //    半径=cr、高さ=左右間距離(0.52)、中心x=0
            const bridgeGeo = new THREE.CylinderGeometry(cr, cr, 0.36, 20);
            bridgeGeo.rotateZ(Math.PI / 2); // X方向に横倒し
            const bridge = new THREE.Mesh(bridgeGeo, shirtMat);
            bridge.name = 'bustBridge';
            bridge.position.set(0, -0.05, p);
            chestMesh.add(bridge);
            clothesGroup.userData.bustBridge = bridge;

            // ② 左右それぞれ外側を球体で覆う
            const coverGeoL = new THREE.SphereGeometry(cr, 16, 16);
            const coverL = new THREE.Mesh(coverGeoL, shirtMat);
            coverL.name = 'bustCoverL';
            coverL.position.set(0.17, -0.05, p);
            chestMesh.add(coverL);

            const coverGeoR = new THREE.SphereGeometry(cr, 16, 16);
            const coverR = new THREE.Mesh(coverGeoR, shirtMat);
            coverR.name = 'bustCoverR';
            coverR.position.set(-0.17, -0.05, p);
            chestMesh.add(coverR);

            // clothesGroupに参照を保持（削除時に使用）
            clothesGroup.userData.bustCovers = [bridge, coverL, coverR];
        }
    }

    targetGroup.add(clothesGroup);

    // ============================================================
    // 【袖】左右別Mesh — 肩関節(shoulder)の子として追加
    // 理由：腕の回転アニメーションに自動追従させるため
    // ============================================================
    // shoulderは createArm() 内で characterGroup に add されている
    // ここでは characterGroup の子を走査して肩を探す
    function addSleeve(shoulderMesh, side) {
        // 半袖：短い開口円筒
        const sleeveGeo = new THREE.CylinderGeometry(
            0.24,  // 上端（肩側）：肩関節を余裕を持って覆う
            0.21,  // 下端（腕側）：腕に向かってやや細く
            0.42,  // 長さ
            16, 1, true // openEnded
        );
        // 袖口（下端）をふさぐ円
        const cuffGeo = new THREE.CircleGeometry(0.21, 16);

        const sleeve = new THREE.Mesh(sleeveGeo, shirtMat);
        const cuff   = new THREE.Mesh(cuffGeo, shirtMat);
        sleeve.name = `sleeve_${side}`;
        cuff.name   = `cuff_${side}`;

        // 円筒を腕方向（X軸）に向ける
        sleeve.rotation.z = Math.PI / 2;
        cuff.rotation.z   = Math.PI / 2;

        // 肩関節中心から腕方向にオフセット
        const offsetX = (side === 'L') ? 0.21 : -0.21;
        sleeve.position.set(offsetX, 0, 0);
        cuff.position.set(offsetX * 2, 0, 0);

        shoulderMesh.add(sleeve);
        shoulderMesh.add(cuff);
    }

    // characterGroup 直下の Mesh を走査して肩(y≈2.3)を特定
    targetGroup.children.forEach(child => {
        if (child.isMesh && Math.abs(child.position.y - 2.15) < 0.05) {
            if (child.position.x > 0) {
                addSleeve(child, 'L');
            } else if (child.position.x < 0) {
                addSleeve(child, 'R');
            }
        }
    });

    return clothesGroup; // 参照を返す（削除・切り替え用）
}


// ============================================================
// createPants() — ズボン生成関数
// ============================================================
// 【構造】
//   ① 腰部円筒   : belly(y=1.5)〜pelvis下端(y≈0.68)をカバー
//   ② 股下円盤   : 腰部円筒の底面を閉じる
//   ③ 左右脚円筒 : 股関節中心(y=0.54)〜足首(y≈-0.17)をカバー
// ============================================================
function createPants(color, targetGroup, data) {

    const pantsMat = new THREE.MeshLambertMaterial({
        color: color,
        side: THREE.DoubleSide,
    });

    const pantsGroup = new THREE.Group();
    pantsGroup.name = 'pantsGroup';

    // ── ① 腰部円筒 ──────────────────────────────────────
    // belly上端y≈1.88 〜 pelvis下端y≈0.68
    // 腰幅: pelvis横半径(0.598)+少しゆとり = 0.64
    const waistTop    = 1.52; // pelvis上端付近
    const waistBottom = 0.68;
    const waistH      = waistTop - waistBottom; // 1.20
    const waistR      = 0.64;

    const waistGeo = new THREE.CylinderGeometry(
        waistR * 0.88, // 上端（ウエスト）
        waistR,        // 下端（腰まわり）
        waistH,
        32, 1, false   // 上下面あり
    );
    // Z方向を0.75倍で楕円断面に
    const wPos = waistGeo.attributes.position;
    for (let i = 0; i < wPos.count; i++) wPos.setZ(i, wPos.getZ(i) * 0.75);
    wPos.needsUpdate = true;
    waistGeo.computeVertexNormals();

    const waist = new THREE.Mesh(waistGeo, pantsMat);
    waist.name = 'pantsWaist';
    waist.position.y = waistBottom + waistH / 2;
    pantsGroup.add(waist);

    // ── ② 股下（腰部底面を薄い円筒で閉じる → 両面から見える）
    const crotchGeo = new THREE.CylinderGeometry(waistR, waistR, 0.04, 32, 1, false);
    const cPos = crotchGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) cPos.setZ(i, cPos.getZ(i) * 0.75);
    cPos.needsUpdate = true;
    crotchGeo.computeVertexNormals();

    const crotch = new THREE.Mesh(crotchGeo, pantsMat);
    crotch.name = 'pantsCrotch';
    crotch.position.y = waistBottom;
    pantsGroup.add(crotch);

    // ── ③ 左右の脚円筒 ───────────────────────────────────
    // 股関節中心y=0.54、足首y = hip.y - thighLen - calfLen - ankleR
    //   = 0.54 - 0.85 - 0.85 - 0.14 = -1.30 → 足首上端y≈-1.16
    // 脚円筒: y=0.54(股関節上端) 〜 y=-1.16(足首上端)
    const legTopY    =  0.54 + 0.22; // 股関節上端
    const legBotY    = -1.10;        // 足首直上
    const legH       = legTopY - legBotY;
    const legTopR    =  0.26;  // 太もも幅
    const legBotR    =  0.16;  // 足首上の幅

    [-0.378, 0.378].forEach((xPos, i) => {
        // 真円断面の円筒
        const legGeo = new THREE.CylinderGeometry(legTopR, legBotR, legH, 24, 1, false);

        const leg = new THREE.Mesh(legGeo, pantsMat);
        leg.name = `pantsLeg_${i === 0 ? 'R' : 'L'}`;
        leg.position.set(xPos, legBotY + legH / 2, 0);
        pantsGroup.add(leg);

        // 裾（下端を閉じる円盤）
        const hemGeo = new THREE.CircleGeometry(legBotR, 24);
        const hem = new THREE.Mesh(hemGeo, pantsMat);
        hem.rotation.x = Math.PI / 2;
        hem.position.set(xPos, legBotY, 0);
        pantsGroup.add(hem);
    });

    targetGroup.add(pantsGroup);
    return pantsGroup;
}

// ============================================================
// createBoots() — 長靴生成関数
// ============================================================
// 【構造（上から順）】
//   ① 筒（シャフト）   : 足首〜すね、ズボンの上に重なる円筒
//   ② 円錐台（アッパー）: 筒の下端〜トゥ上端をつなぐ円錐台
//   ③ トゥ             : 足先の楕円筒
//   ④ ソール           : 足裏を楕円底面とする厚みのある楕円筒
// ============================================================
function createBoots(color, targetGroup) {

    const bootsMat = new THREE.MeshLambertMaterial({ color: color });

    // ── 共通寸法 ────────────────────────────────────────────
    // 足首の位置（knee.y + ankle offset）
    //   hip.y=0.54, knee.y= hip-calfLen = 0.54-0.85 = -0.31(worldY)
    //   ankle は knee の子: ankle.position.y = -calfLen = -0.85
    //   ankle worldY = 0.54 - 0.85 - 0.85 = -1.16
    //   foot.position.set(0, -0.10, +0.18) → foot worldY ≈ -1.26
    //   足の平(sole)はfootの子: sole.position.set(0, 0, +0.08)
    //                           scale.y=0.35, R=0.20 → 高さ≈0.07
    //   足の平上面worldY ≈ -1.26 + 0.07 = -1.19

    // 長靴はcharacterGroup直下に配置（絶対座標で指定）
    // 左足 xPos=+0.378, 右足 xPos=-0.378

    const bootsXPositions = [0.378, -0.378]; // 左右

    bootsXPositions.forEach((xPos) => {

        const bootGroup = new THREE.Group();
        bootGroup.position.set(xPos, 0, 0); // X方向だけオフセット、YZはパーツで指定

        // ── ① 筒（シャフト）────────────────────────────────
        // 足首(y≈-1.16)からすね方向に上がる円筒
        // ズボン裾(y≈-1.10)を2〜3cm超えてズボンに重なるよう上端を高く設定
        const shaftTopY    = -0.78;  // ズボン裾より上（すね中央あたり）
        const shaftBotY    = -1.16;  // 足首ライン
        const shaftH       = shaftTopY - shaftBotY; // 約0.38
        const shaftR       = 0.19;   // 足首〜すねの太さ（ズボン裾円筒legBotR=0.16より少し外側）

        const shaftGeo = new THREE.CylinderGeometry(shaftR, shaftR, shaftH, 20, 1, false);
        const shaft = new THREE.Mesh(shaftGeo, bootsMat);
        shaft.name = 'bootShaft';
        shaft.position.set(0, shaftBotY + shaftH / 2, 0);
        bootGroup.add(shaft);

        // 履き口（上端の輪）: 薄いリング状で履き口を強調
        const cuffGeo = new THREE.CylinderGeometry(shaftR + 0.01, shaftR, 0.04, 20, 1, false);
        const cuff = new THREE.Mesh(cuffGeo, bootsMat);
        cuff.name = 'bootCuff';
        cuff.position.set(0, shaftTopY - 0.02, 0);
        bootGroup.add(cuff);

        // ── 足パーツの実寸（計算済み）──────────────────────────
        // foot worldY=-1.26, worldZ=+0.18
        // sole center Z=+0.26, Rz=0.320, Rx=0.190, Ry=0.070
        // sole Z範囲: -0.06 〜 +0.58  ← ここまでカバー必要
        // sole Y下端: -1.33
        // 長靴Zオフセット = sole中心Z = +0.26 に統一

        const BOOT_Z = +0.28;  // かかと固定で前方に伸ばした中心位置

        // ── ② 円錐台（アッパー）──────────────────────────────
        // 筒下端(shaftBotY)〜トゥ上端をつなぐ円錐台
        // 足首から足の甲にかけてZオフセットしながら広がる
        const upperTopY  = shaftBotY;       // 筒の下端 (-1.16)
        const upperBotY  = -1.06;           // 甲の上端まで引き上げ
        const upperH     = upperTopY - upperBotY;
        const upperTopR  = shaftR;          // 筒と同径 (0.19)
        const upperBotR  = 0.21;            // トゥ上面Rxに合わせる

        const upperGeo = new THREE.CylinderGeometry(upperTopR, upperBotR, upperH, 20, 1, false);
        // Z方向を楕円断面に（足首断面の自然な形）
        const uPos = upperGeo.attributes.position;
        for (let i = 0; i < uPos.count; i++) uPos.setZ(i, uPos.getZ(i) * 0.85);
        uPos.needsUpdate = true;
        upperGeo.computeVertexNormals();

        const upper = new THREE.Mesh(upperGeo, bootsMat);
        upper.name = 'bootUpper';
        // ZはBOOT_Zに向かって徐々にシフト（中間点）
        upper.position.set(0, upperBotY + upperH / 2, BOOT_Z * 0.4);
        bootGroup.add(upper);

        // ── ③ トゥ（足先の楕円筒）──────────────────────────
        // 足の平(sole)をすっぽり覆う楕円筒
        // sole: Rx=0.190, Rz=0.320, center Z=+0.26
        // → 余裕を持って Rx=0.22, Rz=0.36 でカバー
        const toeTopY  = upperBotY;         // アッパー下端 (-1.28)
        const toeBotY  = -1.35;             // ソール上面
        const toeH     = toeTopY - toeBotY;
        const toeRx    = 0.22;              // 足幅(0.190)より一回り大きく
        const toeRz    = 0.54;              // かかと固定で前方1.5倍

        const toeGeo = new THREE.CylinderGeometry(toeRx, toeRx, toeH, 20, 1, false);
        const tPos = toeGeo.attributes.position;
        for (let i = 0; i < tPos.count; i++) tPos.setZ(i, tPos.getZ(i) * (toeRz / toeRx));
        tPos.needsUpdate = true;
        toeGeo.computeVertexNormals();

        const toe = new THREE.Mesh(toeGeo, bootsMat);
        toe.name = 'bootToe';
        toe.position.set(0, toeBotY + toeH / 2, BOOT_Z);  // 足の平中心に合わせる
        bootGroup.add(toe);

        // ── ④ ソール（楕円底面の楕円筒）─────────────────────
        // 足裏(Rx=0.190, Rz=0.320)の1.5倍 → Rx=0.24, Rz=0.40
        const soleRx   = 0.24;    // X方向半径（足幅×1.5）
        const soleRz   = 0.54;    // トゥに合わせて前方1.5倍
        const soleH    = 0.20;    // ソールの厚み
        const soleCenterY = toeBotY - soleH / 2;

        const soleSideGeo = new THREE.CylinderGeometry(soleRx, soleRx, soleH, 24, 1, false);
        const sPos = soleSideGeo.attributes.position;
        for (let i = 0; i < sPos.count; i++) sPos.setZ(i, sPos.getZ(i) * (soleRz / soleRx));
        sPos.needsUpdate = true;
        soleSideGeo.computeVertexNormals();

        const soleSide = new THREE.Mesh(soleSideGeo, bootsMat);
        soleSide.name = 'bootSoleSide';
        soleSide.position.set(0, soleCenterY, BOOT_Z);
        bootGroup.add(soleSide);

        // ソール底面
        const soleBottomGeo = new THREE.CircleGeometry(soleRx, 24);
        soleBottomGeo.computeVertexNormals();

        const soleBottom = new THREE.Mesh(soleBottomGeo, bootsMat);
        soleBottom.name = 'bootSoleBottom';
        soleBottom.rotation.x = -Math.PI / 2;
        soleBottom.scale.set(1, soleRz / soleRx, 1);
        soleBottom.position.set(0, soleCenterY - soleH / 2, BOOT_Z);
        bootGroup.add(soleBottom);

        targetGroup.add(bootGroup);
    });
}


// 4. イベントリスナーとアニメーション
// ★ 修正：監視対象の配列の最後に 'earType' を追加しました
['headScaleY', 'headScaleX', 'jawWidth', 'eyeType', 'hairType', 'bodyColor', 'bustSize', 'bustProtrude', 'earType', 'shirtColor', 'pantsColor', 'bootsColor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', (e) => {
            let val = e.target.value;
            if(el.type === 'range') val = parseFloat(val);
            characterData[id] = val; 
            createCharacter(characterData);
        });
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); 
    renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    
    if (animatedParts.head) animatedParts.head.position.y = (2.87 + 0.70 * characterData.headScaleY) + Math.sin(time * 2) * 0.03;
    if (animatedParts.neck) // neck は neckGroup全体なのでY移動不要（位置は固定）

    if (animatedParts.chest && animatedParts.belly) {
        animatedParts.chest.rotation.x = Math.sin(time * 2) * 0.05;
        animatedParts.belly.rotation.x = Math.sin(time * 2) * 0.02;
    }
    animatedParts.arms.forEach((arm, index) => {
        const sign = index === 0 ? 1 : -1;
        arm.root.rotation.x = Math.sin(time * 1.5) * 0.2 * sign;
        arm.root.rotation.z = 0.1 * sign;
        arm.joint.rotation.x = -0.1 + Math.sin(time * 1.5 + 1.0) * 0.1; 
    });
    animatedParts.legs.forEach((leg) => {
        leg.root.rotation.x = -0.05 + Math.sin(time * 2) * 0.02;
        leg.joint.rotation.x = 0.1 - Math.sin(time * 2) * 0.04;
    });
    controls.update(); 
    renderer.render(scene, camera);
}
animate();

// 5. ダウンロード
document.getElementById('downloadBtn').addEventListener('click', () => {
    const exporter = new THREE.GLTFExporter();
    exporter.parse(characterGroup, function (result) {
        const blob = new Blob([result], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.style.display = 'none';
        link.href = URL.createObjectURL(blob);
        link.download = 'my_character.glb';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }, { binary: true });
});
