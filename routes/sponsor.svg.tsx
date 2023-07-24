import { querySponsor } from '@/afdian/api';
import { h, renderSSR, jsx, Component } from 'nano-jsx';
import { resolveAvatars, strLen } from '@/afdian/helpers';
import { tiers } from '@/afdian/sponsor-tiers';
import { SponsorTier } from '@/afdian/types';
import { chunk } from 'lodash-es';

export default eventHandler(async e => {
  const query = new URL(e.node.req.url, `http://${e.node.req.headers['host']}`)
    .searchParams;

  const width = parseInt(query.get('width') ?? '800');

  const { list, total_page } = (await querySponsor(1)).data;
  for (let i = 1; i < total_page; i++)
    list.concat((await querySponsor(i + 1)).data.list);

  let sponsor = tiers(list);

  let avatars = [] as { user_id: string; avatar: string }[];
  for (const s of sponsor)
    avatars.push(
      ...(await resolveAvatars(
        s.sponsors.map(s => s.user),
        [s.badge.avatarSize, s.badge.avatarSize]
      ))
    );

  class SVG extends Component {
    height = 0;
    components = [];
    fontFamily =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";

    addTitle(text: string) {
      this.components.push(
        <text x={width / 2} y={this.height} text-anchor="middle">
          <tspan
            fill="#777777"
            font-size="20px"
            font-family={this.fontFamily}
            font-weight="500"
          >
            {text}
          </tspan>
        </text>
      );
      this.height += 20;
    }
    addAvatars(st: SponsorTier) {
      const size = st.badge.avatarSize;
      const pad = st.badge.padding ?? 10;
      const sidePad = 20;

      const colMax = Math.floor((width - sidePad * 2) / (size + pad));
      const rowCount = Math.ceil(st.sponsors.length / colMax);

      this.height += size / 2;
      chunk(st.sponsors, colMax).map((chunk, i) => {
        const offset =
          (width - chunk.length * (size + pad)) / 2 + (size + pad) / 2;
        chunk.map((s, j) => {
          const x = offset + (size + pad) * j;
          this.components.push(
            <pattern
              id={`avatar_${s.user.user_id}`}
              x={x - size / 2}
              y={this.height - size / 2}
              width={size}
              height={size}
              patternUnits="userSpaceOnUse"
            >
              <image
                x={0}
                y={0}
                width={size}
                height={size}
                xlink:href={
                  avatars.find(v => v.user_id === s.user.user_id).avatar
                }
              />
            </pattern>
          );
          this.components.push(
            <circle
              r={size / 2}
              cx={x}
              cy={this.height}
              fill={`url(#avatar_${s.user.user_id})`}
            />
          );
          if (st.badge.showName) {
            this.components.push(
              <text x={x} y={this.height + size / 2 + 20} text-anchor="middle">
                <tspan
                  fill="#777777"
                  font-size="14px"
                  font-family={this.fontFamily}
                  font-weight="300"
                >
                  {strLen(s.user.name) > 14
                    ? s.user.name.slice(0, 5) + '...'
                    : s.user.name}
                </tspan>
              </text>
            );
          }
        });
        if (st.badge.showName) this.height += 25;

        if (i < rowCount - 1) this.height += size + pad;
      });

      this.height += size / 2 + 20;
    }

    render() {
      this.height += 20;

      for (const s of sponsor) {
        if (s.sponsors.length === 0) continue;
        this.height += 20;
        this.addTitle(s.title);

        this.addAvatars(s);
      }

      this.height += 20;

      return (
        <svg
          width={width}
          height={this.height}
          viewBox={`0 0 ${width} ${this.height}`}
          xmlns="http://www.w3.org/2000/svg"
          xmlns:xlink="http://www.w3.org/1999/xlink"
        >
          {this.components}
        </svg>
      );
    }
  }

  e.node.res.appendHeader('accept-encoding', 'br');
  e.node.res.appendHeader('content-type', 'image/svg+xml');
  return renderSSR(() => SVG);
});
