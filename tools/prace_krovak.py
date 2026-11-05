"""S-JTSK (Křovák, kladné X/Y z RÚIAN) → WGS84. Standardní převod přes Besselův elipsoid + Helmertovu transformaci."""
from math import sqrt, atan, exp, log, sin, cos, pi


def jtsk_na_wgs(X, Y, H=245.0):
    e = 0.081696831215303
    n = 0.97992470462083
    konst_u_ro = 12310230.12797036
    sinUQ, cosUQ = 0.863499969506341, 0.504348889819882
    sinVQ, cosVQ = 0.420215144586493, 0.907424504992097
    alfa, k = 1.000597498371542, 1.003419163966575
    ro = sqrt(X * X + Y * Y)
    epsilon = 2 * atan(Y / (ro + X))
    D = epsilon / n
    S = 2 * atan(exp(1 / n * log(konst_u_ro / ro))) - pi / 2
    sinS, cosS = sin(S), cos(S)
    sinU = sinUQ * sinS - cosUQ * cosS * cos(D)
    cosU = sqrt(1 - sinU * sinU)
    sinDV = sin(D) * cosS / cosU
    cosDV = sqrt(1 - sinDV * sinDV)
    sinV = sinVQ * cosDV - cosVQ * sinDV
    cosV = cosVQ * cosDV + sinVQ * sinDV
    L = 2 * atan(sinV / (1 + cosV)) / alfa
    t = exp(2 / alfa * log((1 + sinU) / cosU / k))
    pom = (t - 1) / (t + 1)
    while True:
        sinB = pom
        pom = t * exp(e * log((1 + e * sinB) / (1 - e * sinB)))
        pom = (pom - 1) / (pom + 1)
        if abs(pom - sinB) < 1e-15:
            break
    B = atan(pom / sqrt(1 - pom * pom))
    # Bessel → kartézské
    a, f1 = 6377397.15508, 299.152812853
    e2 = 1 - (1 - 1 / f1) ** 2
    ro = a / sqrt(1 - e2 * sin(B) ** 2)
    x = (ro + H) * cos(B) * cos(L)
    y = (ro + H) * cos(B) * sin(L)
    z = ((1 - e2) * ro + H) * sin(B)
    # Helmert S-JTSK → WGS84
    dx, dy, dz = 570.69, 85.69, 462.84
    wz = -5.2611 / 3600 * pi / 180
    wy = -1.58676 / 3600 * pi / 180
    wx = -4.99821 / 3600 * pi / 180
    m = 3.543e-6
    xn = dx + (1 + m) * (x + wz * y - wy * z)
    yn = dy + (1 + m) * (-wz * x + y + wx * z)
    zn = dz + (1 + m) * (wy * x - wx * y + z)
    # kartézské → WGS84
    a, f1 = 6378137.0, 298.257223563
    a_b = f1 / (f1 - 1)
    p = sqrt(xn * xn + yn * yn)
    e2 = 1 - (1 - 1 / f1) ** 2
    theta = atan(zn * a_b / p)
    st, ct = sin(theta), cos(theta)
    t = (zn + e2 * a_b * a * st ** 3) / (p - e2 * a * ct ** 3)
    B = atan(t)
    L = 2 * atan(yn / (p + xn))
    return B / pi * 180, L / pi * 180


if __name__ == '__main__':
    # Benešov, Mariánovice č.p. 1 (≈ 49.80 N, 14.65 E); Praha Karlův most ≈ (50.0865, 14.4114) ~ JTSK Y 743217, X 1042935
    print(jtsk_na_wgs(1081188.26, 728998.95))
    print(jtsk_na_wgs(1042935, 743217))
