import Tag from "./Tag";
import ImageWithSkeleton from "./ImageWithSkeleton";

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
    <div className="w-full max-w-sm border rounded-lg shadow bg-gray-800 border-gray-700">
      <picture className="aspect-video w-full h-auto flex-none">
        <ImageWithSkeleton
          className="rounded-t-lg aspect-video w-full h-48 m-auto object-cover"
          src={props.img}
          alt={`${props.img} tool`}
        />
      </picture>
      <div className="mx-5 mt-3 mb-5 flex flex-col justify-between">
        <h5 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {props.title}
        </h5>
        <div className="mt-auto">
          <div className="flex items-center mt-2.5 mb-5">
            {props.tags.map((item) => (
              <Tag id={item} />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <a
              href={props.url}
              className="inline-flex items-center text-blue-600 hover:underline focus:ring-2 focus:outline-none"
            >
              Visit
              <svg
                className="w-3 h-3 ms-2.5 rtl:rotate-[270deg]"
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
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-center text-white bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Read More
              <svg
                className="rtl:rotate-180 w-3.5 h-3.5 ms-2"
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
