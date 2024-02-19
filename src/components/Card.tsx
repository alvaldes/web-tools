import Tag from "./Tag";

interface Props {
  img: string;
  title: string;
  tags: string[];
  url: string;
  id: string;
}

const Card = (props: Props) => {
  if (props.title.length > 75) {
    props.title = props.title.substring(0, 75) + "...";
  }
  return (
    <div class="w-full max-w-sm border rounded-lg shadow bg-gray-800 border-gray-700">
      <a href={`/${props.id}`}>
        <img
          class="py-4 rounded-t-lg aspect-auto w-[18rem] h-64 m-auto object-contain"
          src={props.img}
          alt="product image"
        />
      </a>
      <div class="px-5 pb-5 flex flex-col justify-between">
        <a href={`/${props.id}`} class="min-h-16">
          <h5 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {props.title}
          </h5>
        </a>
        <div class="mt-auto">
          <div class="flex items-center mt-2.5 mb-5">
            {props.tags.map((item) => (
              <Tag id={item} />
            ))}
          </div>
          <div class="flex items-center justify-between">
            <a
              href={props.url}
              class="inline-flex items-center text-blue-600 hover:underline"
            >
              Visit
              <svg
                class="w-3 h-3 ms-2.5 rtl:rotate-[270deg]"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 18 18"
              >
                <path
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 11v4.833A1.166 1.166 0 0 1 13.833 17H2.167A1.167 1.167 0 0 1 1 15.833V4.167A1.166 1.166 0 0 1 2.167 3h4.618m4.447-2H17v5.768M9.111 8.889l7.778-7.778"
                ></path>
              </svg>
            </a>
            <a
              href={`/${props.id}`}
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Read More
              <svg
                class="rtl:rotate-180 w-3.5 h-3.5 ms-2"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 14 10"
              >
                <path
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M1 5h12m0 0L9 1m4 4L9 9"
                ></path>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card;